import type { ModalSubmitInteraction, Client } from "discord.js";
import { MessageFlags, ComponentType } from "discord.js";
import { CATEGORIES } from "../constants/categories.js";
import type { TicketCategory } from "../types/index.js";
import { buildErrorContainer, buildSuccessContainer } from "../utils/components.js";
import { createTicketChannel, countOpenTickets } from "../utils/ticketHelper.js";
import { setCooldown } from "../utils/cooldown.js";
import { sendLog } from "../utils/logger.js";
import { config } from "../config.js";

// ─── HANDLER: ENVIO DE MODAL V2 ───────────────────────────────────────────────
export async function handleModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client,
): Promise<void> {
  // customId formato: ticket:modal:<categoryId>
  const parts = interaction.customId.split(":");
  if (parts[0] !== "ticket" || parts[1] !== "modal") return;

  const categoryId = parts[2] as TicketCategory;
  const cat = CATEGORIES[categoryId];

  if (!cat || !interaction.guild) {
    await interaction.reply({
      components: [buildErrorContainer("No se pudo procesar tu solicitud.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Verificar limite de tickets abiertos
  const openCount = await countOpenTickets(interaction.guild.id, interaction.user.id);
  if (openCount >= config.maxOpenTickets) {
    await interaction.editReply({
      components: [buildErrorContainer(
        `Ya tienes **${openCount}** tickets abiertos. Cierra uno antes de abrir otro.`,
        client,
      )],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  try {
    console.log("[MODAL SUBMIT DEBUG] customId:", interaction.customId);
    console.log("[MODAL SUBMIT DEBUG] interaction.fields keys:", Object.keys(interaction.fields ?? {}));
    console.log("[MODAL SUBMIT DEBUG] interaction.components:", (interaction as any).components);
    console.log("[MODAL SUBMIT DEBUG] interaction.data:", (interaction as any).data);

    // Deep search for resolved attachments in interaction
    const rawData = (interaction as any).data ?? (interaction as any).raw?.data ?? {};
    const resolvedData = rawData.resolved ?? (interaction as any).fields?.resolved ?? (interaction as any).resolved;
    const attachmentsMap = resolvedData?.attachments;

    console.log("[MODAL SUBMIT DEBUG] attachmentsMap:", attachmentsMap);

    // ─── RECOPILAR DATOS DEL MODAL V2 ───────────────────────────────────────
    const modalData: Record<string, string> = {};

    // 1. Leer TextInputs (metodo clasico, sigue funcionando)
    for (const field of cat.fields) {
      try {
        const value = interaction.fields.getTextInputValue(field.customId);
        if (value) modalData[field.customId] = value;
      } catch {
        // Campo opcional no rellenado o es un Select (no TextInput)
      }
    }

    // 2. Leer Selects (UserSelect, RoleSelect, StringSelect, ChannelSelect) del modal v2
    try {
      const rawComponents = (interaction as any).data?.components ?? (interaction as any).components ?? [];
      for (const row of rawComponents) {
        const inner = row?.component ?? row?.components?.[0] ?? row;
        const type = inner?.type ?? inner?.componentType;
        const customId = inner?.customId ?? inner?.custom_id;
        const values = inner?.values;

        if (customId && values?.length) {
          if (type === ComponentType.UserSelect || type === 5) {
            modalData[customId] = values.map((id: string) => `<@${id}>`).join(", ");
          } else if (type === ComponentType.RoleSelect || type === 6) {
            modalData[customId] = values.map((id: string) => `<@&${id}>`).join(", ");
          } else if (type === ComponentType.ChannelSelect || type === 8) {
            modalData[customId] = values.map((id: string) => `<#${id}>`).join(", ");
          } else {
            modalData[customId] = values.join(", ");
          }
        }
      }
    } catch (err) {
      console.error("[MODAL SELECTS] Error procesando componentes select:", err);
    }

    // 3. Leer FileUploads del modal v2 — los archivos subidos llegan en resolved.attachments
    try {
      const fileMap = new Map<string, string>(); // attachment_id -> url

      // Buscar resolved.attachments en todas las ubicaciones posibles
      const candidateResolved = [
        (interaction as any).fields?.resolved,
        (interaction as any).resolved,
        (interaction as any).data?.resolved,
        (interaction as any).raw?.data?.resolved,
        (interaction as any)._rawData?.data?.resolved,
      ];

      for (const res of candidateResolved) {
        if (!res) continue;
        const atts = res.attachments;
        if (!atts) continue;

        if (typeof atts.get === "function") {
          for (const [id, att] of atts) {
            const url = att?.url ?? att?.proxyURL ?? att?.proxy_url;
            if (url) fileMap.set(String(id), url);
          }
        } else if (typeof atts === "object") {
          for (const id of Object.keys(atts)) {
            const att = atts[id];
            const url = att?.url ?? att?.proxy_url ?? att?.proxyURL;
            if (url) fileMap.set(String(id), url);
          }
        }
      }

      console.log("[MODAL ATTACHMENTS] Archivos encontrados en resolved:", Array.from(fileMap.values()));

      if (fileMap.size > 0) {
        // Mapear a custom_id si existe
        const rawData = (interaction as any).data ?? (interaction as any).raw?.data ?? {};
        const rawComponents = rawData?.components ?? (interaction as any).components ?? [];
        let matchedAny = false;

        for (const row of rawComponents) {
          const inner = row?.component ?? row?.components?.[0] ?? row;
          const isFileUpload = inner?.type === 19 || inner?.componentType === 19;
          if (isFileUpload) {
            const customId = inner.customId ?? inner.custom_id;
            const fileIds: string[] = inner.values ?? [];
            if (customId && fileIds.length) {
              const urls = fileIds.map((id: string) => fileMap.get(String(id))).filter(Boolean) as string[];
              if (urls.length) {
                modalData[customId] = urls.join("\n");
                matchedAny = true;
              }
            }
          }
        }

        // Fallback: si se subieron archivos pero no se mapearon por custom_id, asignarlos al campo de pruebas
        if (!matchedAny) {
          const proofKey = cat.fields.find(f => f.customId === "pruebas" || f.customId === "comprobante" || f.customId === "prueba_ganador")?.customId ?? "pruebas";
          modalData[proofKey] = Array.from(fileMap.values()).join("\n");
          console.log(`[MODAL ATTACHMENTS] Asignados ${fileMap.size} archivo(s) al campo '${proofKey}' vía fallback`);
        }
      }
    } catch (err) {
      console.error("[MODAL] Error al procesar archivos adjuntos:", err);
    }

    // ─── CREAR CANAL DE TICKET ───────────────────────────────────────────────
    const channel = await createTicketChannel(
      interaction.guild,
      interaction.user.id,
      interaction.user.tag,
      categoryId,
      modalData,
      client,
    );

    // Aplicar cooldown
    setCooldown(interaction.user.id, "create_ticket", config.cooldownMs);

    // Responder
    await interaction.editReply({
      components: [buildSuccessContainer(
        "Ticket creado",
        `Tu ticket ha sido creado en ${channel.toString()}. Un miembro del staff te atendra pronto.`,
        client,
      )],
      flags: MessageFlags.IsComponentsV2,
    });

    // Log
    await sendLog(
      client,
      "Ticket Abierto",
      `Ticket creado por ${interaction.user.tag}`,
      [
        { name: "Usuario", value: `<@${interaction.user.id}> (${interaction.user.tag})` },
        { name: "Categoria", value: cat.label },
        { name: "Canal", value: channel.toString() },
        { name: "ID", value: channel.name },
      ],
    );

  } catch (err) {
    console.error("[MODAL] Error creando ticket:", err);
    await interaction.editReply({
      components: [buildErrorContainer(
        "Ocurrio un error al crear tu ticket. Intenta de nuevo mas tarde.",
        client,
      )],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}
