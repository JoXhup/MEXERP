import {
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
} from "discord.js";
import type { CategoryMeta } from "../types/index.js";

// ─── REGLA MODAL V2 ────────────────────────────────────────────────────────────
// Cuando un TextInputBuilder va DENTRO de un LabelBuilder:
//   - NO llevar .setLabel() — el Label ya lo provee
//   - Solo: customId, style, placeholder, required, minLength, maxLength
// El LabelBuilder lleva: setLabel(), setDescription() (Doble Descripción)
// Los Selects V2 (UserSelect, RoleSelect, StringSelect) también se envían mediante LabelBuilder.

// ─── MODAL V2: BUILDER GENÉRICO CON DOBLE DESCRIPCIÓN ──────────────────────────
export function buildCategoryModal(cat: CategoryMeta): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`ticket:modal:${cat.id}`)
    .setTitle(cat.modalTitle);

  const labels: LabelBuilder[] = cat.fields.slice(0, 5).map(field => {
    const input = new TextInputBuilder()
      .setCustomId(field.customId)
      .setStyle(field.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(field.required);

    if (field.placeholder) input.setPlaceholder(field.placeholder);
    if (field.minLength)   input.setMinLength(field.minLength);
    if (field.maxLength)   input.setMaxLength(field.maxLength);

    const label = new LabelBuilder()
      .setLabel(field.label)
      .setTextInputComponent(input);

    if (field.description) {
      label.setDescription(field.description);
    } else {
      label.setDescription(`Ingresa el dato correspondiente para ${field.label.toLowerCase()}`);
    }
    return label;
  });

  modal.addLabelComponents(...labels);
  return modal;
}

// ─── MODAL V2: REPORTAR USUARIO (USER SELECT + STRING SELECT V2) ─────────────
export function buildReportarUsuarioModalV2(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:reportar_usuario")
    .setTitle("Reporte de Usuario");

  const userSelect = new UserSelectMenuBuilder()
    .setCustomId("usuario_reportado")
    .setPlaceholder("Selecciona al usuario a reportar...")
    .setMinValues(1)
    .setMaxValues(1);

  const l1 = new LabelBuilder()
    .setLabel("Usuario reportado")
    .setDescription("Selecciona al usuario en la lista de Discord")
    .setUserSelectMenuComponent(userSelect);

  const tipoSelect = new StringSelectMenuBuilder()
    .setCustomId("tipo_prueba")
    .setPlaceholder("Selecciona el tipo de prueba que tienes...")
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Capturas de pantalla").setValue("Capturas"),
      new StringSelectMenuOptionBuilder().setLabel("Video o grabación").setValue("Video"),
      new StringSelectMenuOptionBuilder().setLabel("Testigos presenciales").setValue("Testigos"),
      new StringSelectMenuOptionBuilder().setLabel("Logs del servidor").setValue("Logs"),
      new StringSelectMenuOptionBuilder().setLabel("Sin pruebas").setValue("Sin pruebas"),
    );

  const l2 = new LabelBuilder()
    .setLabel("Tipo de prueba disponible")
    .setDescription("Indica con qué tipo de evidencia cuentas")
    .setStringSelectMenuComponent(tipoSelect);

  const l3 = new LabelBuilder()
    .setLabel("Motivo del reporte")
    .setDescription("Proporciona el mayor detalle posible de la falta")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("motivo")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe detalladamente el motivo del reporte...")
        .setRequired(true).setMinLength(15).setMaxLength(1000)
    );

  const l4 = new LabelBuilder()
    .setLabel("Links de pruebas (opcional)")
    .setDescription("Enlaces a capturas, videos o imágenes (opcional)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("pruebas")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("https://imgur.com/... o descripción de las pruebas")
        .setRequired(false).setMaxLength(500)
    );

  modal.addLabelComponents(l1, l2, l3, l4);
  return modal;
}

// ─── MODAL V2: RECLAMO DE RECOMPENSAS (STRING SELECT V2) ──────────────────────
export function buildRecompensasModalV2(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:recompensas")
    .setTitle("Reclamo de Recompensas");

  const rewardSelect = new StringSelectMenuBuilder()
    .setCustomId("premio_ganado")
    .setPlaceholder("Selecciona la recompensa ganada...")
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Robux").setValue("Robux"),
      new StringSelectMenuOptionBuilder().setLabel("Discord Nitro").setValue("Discord Nitro"),
      new StringSelectMenuOptionBuilder().setLabel("Rango VIP / Donante").setValue("Rango VIP"),
      new StringSelectMenuOptionBuilder().setLabel("Vehículo / Beneficio IC").setValue("Beneficio IC"),
      new StringSelectMenuOptionBuilder().setLabel("Otro premio").setValue("Otro premio"),
    );

  const l1 = new LabelBuilder()
    .setLabel("Premio o recompensa a reclamar")
    .setDescription("Selecciona el tipo de premio o recompensa obtenida")
    .setStringSelectMenuComponent(rewardSelect);

  const l2 = new LabelBuilder()
    .setLabel("Evento o sorteo donde lo ganaste")
    .setDescription("Indica el nombre del sorteo, evento o dinámica")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("evento_sorteo")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Nombre del sorteo o evento")
        .setRequired(true).setMinLength(3).setMaxLength(150)
    );

  const l3 = new LabelBuilder()
    .setLabel("Prueba de ganador (opcional)")
    .setDescription("Link al mensaje del sorteo o captura (opcional)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("pruebas")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Link del mensaje del sorteo o captura de pantalla...")
        .setRequired(false).setMaxLength(500)
    );

  modal.addLabelComponents(l1, l2, l3);
  return modal;
}

// ─── MODAL V2: ROBOS IC (STRING SELECT V2) ────────────────────────────────────
export function buildRobosICModalV2(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:robos_ic")
    .setTitle("Reclamo de Robo IC");

  const roboSelect = new StringSelectMenuBuilder()
    .setCustomId("monto_robo")
    .setPlaceholder("Selecciona los bienes o monto robado...")
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Dinero en Efectivo IC").setValue("Dinero IC"),
      new StringSelectMenuOptionBuilder().setLabel("Armamento IC").setValue("Armamento"),
      new StringSelectMenuOptionBuilder().setLabel("Vehículo IC").setValue("Vehículo"),
      new StringSelectMenuOptionBuilder().setLabel("Objetos / Mercancía").setValue("Objetos/Mercancía"),
    );

  const l1 = new LabelBuilder()
    .setLabel("Monto o bienes robados")
    .setDescription("Selecciona la categoría de lo robado en la escena IC")
    .setStringSelectMenuComponent(roboSelect);

  const l2 = new LabelBuilder()
    .setLabel("Circunstancias del robo IC")
    .setDescription("Describe el lugar, hora e involucrados en el robo")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("detalles_robo")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe las circunstancias en que se llevó a cabo el robo...")
        .setRequired(true).setMinLength(15).setMaxLength(1000)
    );

  const l3 = new LabelBuilder()
    .setLabel("Pruebas del robo IC (opcional)")
    .setDescription("Capturas, clips de video o evidencias (opcional)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("pruebas")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Capturas, clips de video o evidencias...")
        .setRequired(false).setMaxLength(500)
    );

  modal.addLabelComponents(l1, l2, l3);
  return modal;
}

// ─── MODAL V2: REPORTAR STAFF (USER SELECT + STRING SELECT V2) ───────────────
export function buildReportarStaffModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:reporte_staff")
    .setTitle("Reporte de Staff");

  const staffSelect = new UserSelectMenuBuilder()
    .setCustomId("staff_reportado")
    .setPlaceholder("Selecciona al miembro del Staff...")
    .setMinValues(1)
    .setMaxValues(1);

  const l1 = new LabelBuilder()
    .setLabel("Miembro del Staff reportado")
    .setDescription("Selecciona al integrante del staff en la lista de Discord")
    .setUserSelectMenuComponent(staffSelect);

  const gravSelect = new StringSelectMenuBuilder()
    .setCustomId("gravedad")
    .setPlaceholder("Selecciona la gravedad del incidente...")
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Leve — mal comportamiento puntual").setValue("Leve"),
      new StringSelectMenuOptionBuilder().setLabel("Moderado — abuso de permisos").setValue("Moderado"),
      new StringSelectMenuOptionBuilder().setLabel("Grave — acoso o discriminación").setValue("Grave"),
      new StringSelectMenuOptionBuilder().setLabel("Muy grave — corrupción activa").setValue("Muy Grave"),
    );

  const l2 = new LabelBuilder()
    .setLabel("Gravedad del incidente")
    .setDescription("Evalúa la severidad de lo que ocurrió")
    .setStringSelectMenuComponent(gravSelect);

  const l3 = new LabelBuilder()
    .setLabel("Descripción del incidente")
    .setDescription("Sé totalmente específico con fechas y acciones")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("incidente")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe el comportamiento inadecuado del staff...")
        .setRequired(true).setMinLength(20).setMaxLength(1000)
    );

  const l4 = new LabelBuilder()
    .setLabel("Pruebas o evidencias (opcional)")
    .setDescription("Enlaces a imágenes o videos del incidente (opcional)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("pruebas")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Capturas, links o nombres de testigos...")
        .setRequired(false).setMaxLength(500)
    );

  modal.addLabelComponents(l1, l2, l3, l4);
  return modal;
}

// ─── MODAL V2: SOLICITUD DE ROL (ROLE SELECT V2) ───────────────────────────────
export function buildSolicitudRolModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:solicitud_rol")
    .setTitle("Solicitud de Rol");

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("rol_solicitado")
    .setPlaceholder("Selecciona el rol de Discord solicitado...")
    .setMinValues(1).setMaxValues(1);

  const l1 = new LabelBuilder()
    .setLabel("Rol solicitado")
    .setDescription("Selecciona directamente el rol del servidor que solicitas")
    .setRoleSelectMenuComponent(roleSelect);

  const l2 = new LabelBuilder()
    .setLabel("Motivo de la solicitud")
    .setDescription("Explica la razón y justifica tu solicitud")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("motivo")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Explica el motivo por el cual solicitas este rol...")
        .setRequired(true).setMinLength(10).setMaxLength(800)
    );

  const l3 = new LabelBuilder()
    .setLabel("Evidencia de requisitos (opcional)")
    .setDescription("Enlaces a capturas o evidencias de requisitos cumplidos")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("pruebas")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Capturas, enlaces o pruebas de cumplimiento de requisitos...")
        .setRequired(false).setMaxLength(500)
    );

  modal.addLabelComponents(l1, l2, l3);
  return modal;
}

// ─── MODAL V2: COMPRAS REALES ─────────────────────────────────────────────────
export function buildComprasRealesModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:compras_reales")
    .setTitle("Gestion de Compra Real");

  const metodoSelect = new StringSelectMenuBuilder()
    .setCustomId("metodo_pago")
    .setPlaceholder("Metodo de pago utilizado...")
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Robux").setValue("robux"),
      new StringSelectMenuOptionBuilder().setLabel("PayPal").setValue("paypal"),
      new StringSelectMenuOptionBuilder().setLabel("Transferencia bancaria").setValue("banco"),
      new StringSelectMenuOptionBuilder().setLabel("Tarjeta de credito/debito").setValue("tarjeta"),
      new StringSelectMenuOptionBuilder().setLabel("Otro metodo").setValue("otro"),
    );

  const l1 = new LabelBuilder()
    .setLabel("Metodo de pago")
    .setDescription("Selecciona como realizaste el pago")
    .setStringSelectMenuComponent(metodoSelect);

  const l2 = new LabelBuilder()
    .setLabel("Monto pagado")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("monto")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ej: $5 USD / 1000 Robux")
        .setRequired(true).setMaxLength(50)
    );

  const l3 = new LabelBuilder()
    .setLabel("Comprobante de pago")
    .setDescription("Adjunta o describe tu evidencia de pago")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("comprobante")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Link de la captura de pago o descripcion del comprobante...")
        .setRequired(true).setMinLength(10).setMaxLength(500)
    );

  const l4 = new LabelBuilder()
    .setLabel("Beneficio esperado")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("que_esperas")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Rol, beneficio, item o servicio que compraste...")
        .setRequired(true).setMinLength(10).setMaxLength(400)
    );

  modal.addLabelComponents(l1, l2, l3, l4);
  return modal;
}

// ─── MODAL V2: SOLICITUD DE CK ────────────────────────────────────────────────
export function buildCKModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:solicitud_ck")
    .setTitle("Solicitud de CK");

  const ckSelect = new StringSelectMenuBuilder()
    .setCustomId("tipo_ck")
    .setPlaceholder("Selecciona el tipo de CK...")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Auto CK").setValue("Auto CK").setDescription("Eliminación voluntaria de tu propio personaje"),
      new StringSelectMenuOptionBuilder().setLabel("CK").setValue("CK").setDescription("Kill permanente de personaje"),
      new StringSelectMenuOptionBuilder().setLabel("CK Administrativo").setValue("CK Administrativo").setDescription("Ejecutado por sanción o decisión administrativa"),
      new StringSelectMenuOptionBuilder().setLabel("CK Cadena Perpetua").setValue("CK Cadena Perpetua").setDescription("Eliminación por condena máxima de prisión"),
      new StringSelectMenuOptionBuilder().setLabel("CK2").setValue("CK2").setDescription("Solicitud especial de CK secundario"),
    );

  const l1 = new LabelBuilder()
    .setLabel("Tipo de CK")
    .setDescription("Selecciona la modalidad de CK que solicitas")
    .setStringSelectMenuComponent(ckSelect);

  const l2 = new LabelBuilder()
    .setLabel("Nombre completo del personaje IC")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("nombre_personaje")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Nombre y apellido de tu personaje IC")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(100)
    );

  const l3 = new LabelBuilder()
    .setLabel("Motivo de la solicitud de CK")
    .setDescription("Explica la razón de la eliminación del personaje...")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("motivo_ck")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Explica la razón de la solicitud...")
        .setRequired(true)
        .setMinLength(15)
        .setMaxLength(1000)
    );

  modal.addLabelComponents(l1, l2, l3);
  return modal;
}

// ─── MODAL V2: ÁREA DE ROL (STRING SELECT + CO-FUNDADOR OPCIONAL) ─────────────
export function buildAreaRolModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:area_rol")
    .setTitle("Solicitud de Área de ROL");

  const tipoSelect = new StringSelectMenuBuilder()
    .setCustomId("tipo_organizacion")
    .setPlaceholder("Selecciona el tipo de organización...")
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Facción Legal").setValue("Facción Legal").setDescription("LSPD, Gobierno, Médicos, etc."),
      new StringSelectMenuOptionBuilder().setLabel("Facción Ilegal").setValue("Facción Ilegal").setDescription("Cartel, Mafia, Pandilla, etc."),
      new StringSelectMenuOptionBuilder().setLabel("Organización Extranjera").setValue("Organización Extranjera").setDescription("Mercenarios o Grupo Internacional"),
      new StringSelectMenuOptionBuilder().setLabel("Empresa / Negocio").setValue("Empresa / Negocio").setDescription("Taller, Discoteca, Comercio IC"),
    );

  const l1 = new LabelBuilder()
    .setLabel("Tipo de Organización")
    .setDescription("Selecciona la modalidad oficial de tu proyecto de ROL")
    .setStringSelectMenuComponent(tipoSelect);

  const l2 = new LabelBuilder()
    .setLabel("Co-Fundador / Encargado (Opcional)")
    .setDescription("Menciona o indica al usuario secundario de la facción si aplica")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("cofundador_usuario")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Nombre, Tag o ID del Co-Fundador (Opcional)")
        .setRequired(false).setMaxLength(100)
    );

  const l3 = new LabelBuilder()
    .setLabel("Nombre de la facción o empresa")
    .setDescription("Ingresa el nombre exacto de la organización")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("nombre_faccion")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ej: Cartel de Sonora / Taller Mecánico Los Santos")
        .setRequired(true).setMinLength(3).setMaxLength(100)
    );

  const l4 = new LabelBuilder()
    .setLabel("Lore, Objetivos e Historia")
    .setDescription("Describe la trama IC, actividades iniciales y miembros fundadores")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("detalles")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe la historia, objetivos y miembros fundadores...")
        .setRequired(true).setMinLength(20).setMaxLength(1000)
    );

  modal.addLabelComponents(l1, l2, l3, l4);
  return modal;
}

// ─── MODAL V2: CONTROL DE ROL ─────────────────────────────────────────────────
export function buildControlRolModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:control_rol")
    .setTitle("Control de Rol");

  const l1 = new LabelBuilder()
    .setLabel("Solicitud")
    .setDescription("Describe tu solicitud para el control de rol")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("solicitud")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Describe tu solicitud")
        .setRequired(true).setMinLength(3).setMaxLength(150)
    );

  const l2 = new LabelBuilder()
    .setLabel("Detalles")
    .setDescription("Ingresa los detalles amplios de tu solicitud")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("detalles")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe detalladamente la solicitud y los requerimientos...")
        .setRequired(true).setMinLength(10).setMaxLength(1000)
    );

  modal.addLabelComponents(l1, l2);
  return modal;
}

// ─── MODAL V2: RETIRO DE ROL (ROLE SELECT V2) ─────────────────────────────────
export function buildRetiroRolModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:retiro_rol")
    .setTitle("Solicitud de Retiro de Rol");

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("rol_a_remover")
    .setPlaceholder("Selecciona el rol de Discord a retirar...");

  const l1 = new LabelBuilder()
    .setLabel("Rol de Discord a remover")
    .setDescription("Selecciona directamente el rol del servidor que solicitas retirar")
    .setRoleSelectMenuComponent(roleSelect);

  const l2 = new LabelBuilder()
    .setLabel("Motivo de la solicitud")
    .setDescription("Explica la razón por la que solicitas la remoción del rol")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("motivo")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Explica el motivo por el cual solicitas la remoción...")
        .setRequired(true).setMinLength(10).setMaxLength(800)
    );

  modal.addLabelComponents(l1, l2);
  return modal;
}

// ─── MODAL V2: SOLICITUD DE ROLEPLAY (STRING SELECT + USER SELECT V2) ─────────
export function buildSolicitudRPModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:solicitud_rp")
    .setTitle("Solicitud de Roleplay");

  const rpSelect = new StringSelectMenuBuilder()
    .setCustomId("tipo_rp")
    .setPlaceholder("Selecciona el tipo de situación de RP...")
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Evento de RP").setValue("Evento de RP").setDescription("Coordinación de evento masivo"),
      new StringSelectMenuOptionBuilder().setLabel("Tiroteo / Enfrentamiento").setValue("Tiroteo").setDescription("Supervisión de tiroteo IC"),
      new StringSelectMenuOptionBuilder().setLabel("Asalto / Secuestro").setValue("Asalto / Secuestro").setDescription("Negociación o asistencia de staff"),
      new StringSelectMenuOptionBuilder().setLabel("Otro tipo de RP").setValue("Otro RP").setDescription("Situaciones especiales de roleplay"),
    );

  const l1 = new LabelBuilder()
    .setLabel("Tipo de situación de RP")
    .setDescription("Selecciona la categoría del evento o escena a coordinar")
    .setStringSelectMenuComponent(rpSelect);

  const l2 = new LabelBuilder()
    .setLabel("Participante principal / Líder (Opcional)")
    .setDescription("Menciona al usuario involucrado en la escena si aplica (opcional)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("participante_principal")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Nombre, Tag o ID del participante (Opcional)")
        .setRequired(false).setMaxLength(100)
    );

  const l3 = new LabelBuilder()
    .setLabel("Detalles y requerimientos del Staff")
    .setDescription("Describe la situación y qué requieren del equipo de soporte")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("detalles_rp")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe cómo se desarrollará la situación y qué requieren del staff...")
        .setRequired(true).setMinLength(15).setMaxLength(1000)
    );

  modal.addLabelComponents(l1, l2, l3);
  return modal;
}

// ─── MODAL V2: REPORTE DE DESARROLLO / BOT (STRING SELECT V2) ─────────────────
export function buildReporteDesarrolloModalV2(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:reporte_desarrollo")
    .setTitle("Reporte de Desarrollo / BOT");

  const sysSelect = new StringSelectMenuBuilder()
    .setCustomId("sistema_fallo")
    .setPlaceholder("Selecciona el sistema o comando con falla...")
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Economía / Banco").setValue("Economía"),
      new StringSelectMenuOptionBuilder().setLabel("Trámite INE").setValue("INE"),
      new StringSelectMenuOptionBuilder().setLabel("Verificación OAuth").setValue("Verificación"),
      new StringSelectMenuOptionBuilder().setLabel("Sistema de Tickets").setValue("Tickets"),
      new StringSelectMenuOptionBuilder().setLabel("Comandos Slash / IA").setValue("Comandos / IA"),
      new StringSelectMenuOptionBuilder().setLabel("Otro problema técnico").setValue("Otro"),
    );

  const l1 = new LabelBuilder()
    .setLabel("Sistema o Comando con falla")
    .setDescription("Selecciona la función técnica donde ocurrió el error")
    .setStringSelectMenuComponent(sysSelect);

  const l2 = new LabelBuilder()
    .setLabel("Descripción del error técnico")
    .setDescription("Describe los pasos para reproducir la falla o lo que ocurrió")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("descripcion_bug")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe los pasos para reproducir la falla...")
        .setRequired(true).setMinLength(15).setMaxLength(1000)
    );

  const l3 = new LabelBuilder()
    .setLabel("Capturas o evidencias (opcional)")
    .setDescription("Enlaces a imágenes o capturas de la falla (opcional)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("pruebas")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Enlace a imágenes o capturas de la falla...")
        .setRequired(false).setMaxLength(500)
    );

  modal.addLabelComponents(l1, l2, l3);
  return modal;
}

// ─── MODAL: MOTIVO DE CIERRE DE TICKET ─────────────────────────────────────────
export function buildCloseTicketModal(channelId: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`ticket:closemodal:${channelId}`)
    .setTitle("Cerrar Ticket");

  const input = new TextInputBuilder()
    .setCustomId("motivo")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Escribe el motivo por el cual se cierra este ticket...")
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(500);

  const label = new LabelBuilder()
    .setLabel("Motivo de Cierre")
    .setDescription("Proporciona una razón para el cierre del ticket")
    .setTextInputComponent(input);

  modal.addLabelComponents(label);
  return modal;
}

// ─── RAW MODALS CON FILE UPLOAD (type 19) ─────────────────────────────────────
function rawTextLabel(label: string, customId: string, style: 1 | 2, placeholder: string, required: boolean, minLength?: number, maxLength?: number) {
  return {
    type: 18,
    label,
    component: {
      type: 4,
      custom_id: customId,
      style,
      placeholder,
      required,
      ...(minLength ? { min_length: minLength } : {}),
      ...(maxLength ? { max_length: maxLength } : {}),
    },
  };
}

function rawFileLabel(label: string, description: string, customId: string, required = false) {
  return {
    type: 18,
    label,
    description,
    component: {
      type: 19,
      custom_id: customId,
      required,
      min_values: required ? 1 : 0,
      max_values: 10,
    },
  };
}

export function buildRawReportarUsuarioModal() {
  return {
    title: "Reporte de Usuario",
    custom_id: "ticket:modal:reportar_usuario",
    components: [
      rawTextLabel("Usuario reportado", "usuario_reportado", 1, "Nombre, Tag o ID del usuario a reportar", true, 2, 100),
      rawTextLabel("Motivo del reporte", "motivo", 2, "Describe detalladamente la infracción cometida...", true, 15, 1000),
      rawFileLabel("Pruebas o evidencias", "Sube capturas o archivos de evidencia (opcional)", "pruebas", false),
    ],
  };
}

export function buildRawReporteStaffModal() {
  return {
    title: "Reporte de Staff",
    custom_id: "ticket:modal:reporte_staff",
    components: [
      rawTextLabel("Miembro del Staff reportado", "staff_reportado", 1, "Nombre o Tag del staff", true, 2, 100),
      rawTextLabel("Descripción del incidente", "incidente", 2, "Describe lo sucedido de forma objetiva...", true, 20, 1000),
      rawFileLabel("Pruebas visuales", "Sube evidencias visuales o capturas del incidente (opcional)", "pruebas", false),
    ],
  };
}

export function buildRawRecompensasModal() {
  return {
    title: "Reclamo de Recompensas",
    custom_id: "ticket:modal:recompensas",
    components: [
      rawTextLabel("Premio o recompensa a reclamar", "premio_ganado", 1, "Ej: 500 Robux, Discord Nitro, Rango VIP", true, 3, 150),
      rawTextLabel("Evento o sorteo donde lo ganaste", "evento_sorteo", 1, "Nombre del sorteo o evento", true, 3, 150),
      rawFileLabel("Prueba de ganador", "Sube captura del mensaje de sorteo o prueba similar", "pruebas", false),
    ],
  };
}

export function buildRawRobosICModal() {
  return {
    title: "Reclamo de Robo IC",
    custom_id: "ticket:modal:robos_ic",
    components: [
      rawTextLabel("Monto o bienes robados", "monto_robo", 1, "Ej: $50,000 IC / Armamento", true, 2, 100),
      rawTextLabel("Circunstancias e involucrados", "detalles_robo", 2, "Describe dónde y cómo ocurrió el robo...", true, 15, 1000),
      rawFileLabel("Pruebas del robo IC", "Sube evidencias o capturas del robo IC", "pruebas", false),
    ],
  };
}

export function buildRawReporteDesarrolloModal() {
  return {
    title: "Reporte de Desarrollo / BOT",
    custom_id: "ticket:modal:reporte_desarrollo",
    components: [
      rawTextLabel("Comando, sistema o función con falla", "sistema_fallo", 1, "Ej: /multas, verificación OAuth, economía", true, 3, 150),
      rawTextLabel("Descripción del error técnico", "descripcion_bug", 2, "Describe los pasos para reproducir la falla...", true, 15, 1000),
      rawFileLabel("Capturas o evidencias del error", "Sube capturas de pantalla o evidencia de la falla", "pruebas", false),
    ],
  };
}
