import {
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  AttachmentBuilder,
  MessageFlags,
  SeparatorSpacingSize,
  type ModalSubmitInteraction,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { VerifiedUser } from "../models/VerifiedUser.js";
import { Ine } from "../models/Ine.js";
import {
  ESTADOS_MEXICO,
  splitFullName,
  generateCURP,
  generateClaveElector,
  renderIneImage,
} from "../utils/ineGenerator.js";
import { getFooterTimestamp } from "../utils/components.js";

/** Construye el modal de trámite de INE */
export function buildIneModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ine:modal")
    .setTitle("Tramite de INE — Tamaulipas RP");

  // 1. Nombre
  const l1 = new LabelBuilder()
    .setLabel("Nombre")
    .setDescription("Coloca tu nombre completo IC (máximo 100 caracteres)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("nombre")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ej: Juan Carlos Pérez García")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(100)
    );

  // 2. Domicilio
  const l2 = new LabelBuilder()
    .setLabel("Domicilio")
    .setDescription("Coloca un domicilio IC")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("domicilio")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ej: Av. Revolución #123, Col. Centro")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(100)
    );

  // 3. Fecha de Nacimiento
  const l3 = new LabelBuilder()
    .setLabel("Fecha de Nacimiento")
    .setDescription("Pon tu fecha de nacimiento como: 01/02/2002")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("fecha_nacimiento")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("01/02/2002")
        .setRequired(true)
        .setMinLength(8)
        .setMaxLength(10)
    );

  // 4. Sexo (Select menu)
  const l4 = new LabelBuilder()
    .setLabel("Sexo")
    .setDescription("Selecciona tu sexo")
    .setStringSelectMenuComponent(
      new StringSelectMenuBuilder()
        .setCustomId("sexo")
        .setPlaceholder("Selecciona tu sexo...")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel("Hombre").setValue("Hombre"),
          new StringSelectMenuOptionBuilder().setLabel("Mujer").setValue("Mujer")
        )
    );

  // 5. Estado (Select menu de 25 opciones)
  const stateOptions = ESTADOS_MEXICO.map((est) =>
    new StringSelectMenuOptionBuilder().setLabel(est).setValue(est)
  );

  const l5 = new LabelBuilder()
    .setLabel("Estado")
    .setDescription("Selecciona tu estado")
    .setStringSelectMenuComponent(
      new StringSelectMenuBuilder()
        .setCustomId("estado")
        .setPlaceholder("Selecciona tu estado...")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(...stateOptions)
  );

  modal.addLabelComponents(l1, l2, l3, l4, l5);
  return modal;
}

/** Maneja la ejecución del comando /tramitar ine */
export async function handleTramitarCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.showModal(buildIneModal());
}

/** Maneja la entrega del modal del INE */
export async function handleIneModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client
): Promise<void> {
  await interaction.deferReply();

  // Leer campos de texto
  const nombreInput   = interaction.fields.getTextInputValue("nombre").trim();
  const domicilioInput = interaction.fields.getTextInputValue("domicilio").trim();
  const fechaNacInput = interaction.fields.getTextInputValue("fecha_nacimiento").trim();

  // Leer select menus
  let sexoInput = "Hombre";
  let estadoInput = "Ciudad de México (CDMX)";

  try {
    // Método 1: Intentar leer con getStringSelectValues si está disponible
    try {
      const sVal = interaction.fields.getStringSelectValues("sexo");
      if (sVal?.length) sexoInput = sVal[0];
    } catch { /* ok */ }

    try {
      const eVal = interaction.fields.getStringSelectValues("estado");
      if (eVal?.length) estadoInput = eVal[0];
    } catch { /* ok */ }

    // Método 2: Iterar sobre componentes del modal
    for (const row of (interaction as any).components ?? []) {
      const inner = row?.components?.[0] ?? row;
      const customId = inner?.customId ?? inner?.data?.custom_id;
      const vals = inner?.values as string[];
      if (vals?.length) {
        if (customId === "sexo") sexoInput = vals[0];
        if (customId === "estado") estadoInput = vals[0];
      }
    }
  } catch (err) {
    console.error("[INE] Error leyendo selects del modal:", err);
  }

  // Buscar usuario verificado en Roblox y obtener su avatar de Roblox
  let robloxUsername = "Sin vincular (No verificado)";
  let avatarUrl = interaction.user.displayAvatarURL({ extension: "png", size: 256 });

  try {
    const verified = await VerifiedUser.findOne({ discordId: interaction.user.id });
    if (verified?.robloxName) {
      robloxUsername = `@${verified.robloxName}`;
      // Intentar obtener la imagen del avatar de Roblox
      try {
        const thumbRes = (await fetch(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${verified.robloxId}&size=420x420&format=Png&isCircular=false`
        )) as any;
        if (thumbRes.ok) {
          const thumbData = (await thumbRes.json()) as any;
          if (thumbData?.data?.[0]?.imageUrl) {
            avatarUrl = thumbData.data[0].imageUrl;
          }
        }
      } catch (err) {
        console.error("[INE] Error obteniendo thumbnail de Roblox:", err);
      }
    }
  } catch (err) {
    console.error("[INE] Error buscando en DB:", err);
  }

  // Generar datos ficticios de INE
  const nameParts = splitFullName(nombreInput);
  const sexChar = sexoInput.toUpperCase().startsWith("M") ? "M" : "H";
  const curp = generateCURP(
    nameParts.nombre,
    nameParts.apellidoPaterno,
    nameParts.apellidoMaterno,
    fechaNacInput,
    sexChar,
    estadoInput
  );

  const claveElector = generateClaveElector(
    nameParts.nombre,
    nameParts.apellidoPaterno,
    nameParts.apellidoMaterno,
    fechaNacInput,
    sexChar,
    estadoInput,
    2024
  );

  const seccion = Math.floor(1000 + Math.random() * 9000).toString();
  const vigencia = "2028";
  const numIne = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  const domicilioConEstado = `${domicilioInput}, ${estadoInput}`;

  // Asignar rol 1531425402193449093 y quitar rol 1531425281502613675
  const guild = interaction.guild;
  if (guild) {
    try {
      const member =
        guild.members.cache.get(interaction.user.id) ??
        (await guild.members.fetch(interaction.user.id));

      if (member) {
        // Asignar rol nuevo de INE
        try {
          await member.roles.add("1531425402193449093", "Tramite de INE completado");
        } catch (err) {
          console.error("[INE] Error agregando rol 1531425402193449093:", err);
        }

        // Quitar rol anterior
        try {
          if (member.roles.cache.has("1531425281502613675")) {
            await member.roles.remove("1531425281502613675", "Tramite de INE completado");
          }
        } catch (err) {
          console.error("[INE] Error quitando rol 1531425281502613675:", err);
        }
      }
    } catch (err) {
      console.error("[INE] Error actualizando roles del miembro:", err);
    }
  }

  // Guardar/Actualizar en MongoDB
  try {
    await Ine.findOneAndUpdate(
      { discordId: interaction.user.id },
      {
        discordId: interaction.user.id,
        nombre: nombreInput,
        domicilio: domicilioConEstado,
        fechaNacimiento: fechaNacInput,
        sexo: sexoInput,
        estado: estadoInput,
        robloxUsername,
        curp,
        claveElector,
        seccion,
        vigencia,
        numIne,
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("[INE] Error guardando registro en DB:", err);
  }

  // Renderizar la credencial con Canvas usando el avatar de Roblox
  let attachment: AttachmentBuilder;
  try {
    const buffer = await renderIneImage({
      nombre: nombreInput,
      domicilio: domicilioInput,
      estado: estadoInput,
      fechaNacimiento: fechaNacInput,
      sexo: sexChar,
      curp,
      claveElector,
      seccion,
      vigencia,
      avatarUrl,
    });
    attachment = new AttachmentBuilder(buffer, { name: "ine.png" });
  } catch (err) {
    console.error("[INE] Error generando imagen Canvas:", err);
    await interaction.editReply({ content: "Error al generar la imagen de la credencial INE." });
    return;
  }

  // Construir Container V2
  const userAvatar = interaction.user.displayAvatarURL({ size: 256 });

  const container = new ContainerBuilder()
    .setAccentColor(0x0055a5) // Azul INE
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("# INE")
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`Documento **INE** de <@${interaction.user.id}>`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(userAvatar)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Nombre:** ${nombreInput}`,
          `**Roblox:** ${robloxUsername}`,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**CURP:** \`${curp}\``,
          `**SECCIÓN:** \`${seccion}\``,
          `**VIGENCIA:** \`${vigencia}\``,
          `**CLAVE DE ELECTOR:** \`${claveElector}\``,
          `**N.º DE INE:** \`${numIne}\``,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Tamaulipas RP System · ${getFooterTimestamp()}`)
    );

  await interaction.editReply({
    components: [container],
    files: [attachment],
    flags: MessageFlags.IsComponentsV2,
  });
}
