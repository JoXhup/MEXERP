import {
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { CategoryMeta } from "../types/index.js";

// ─── REGLA MODAL V2 ────────────────────────────────────────────────────────────
// Cuando un TextInputBuilder va DENTRO de un LabelBuilder:
//   - NO llevar .setLabel() — el Label ya lo provee
//   - Solo: customId, style, placeholder, required, minLength, maxLength
// El LabelBuilder lleva: setLabel(), setDescription() (opcional)

// ─── MODAL V2: BUILDER GENERICO ───────────────────────────────────────────────
export function buildCategoryModal(cat: CategoryMeta): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`ticket:modal:${cat.id}`)
    .setTitle(cat.modalTitle);

  const labels: LabelBuilder[] = cat.fields.slice(0, 5).map(field => {
    // TextInput SIN .setLabel() dentro del Label
    const input = new TextInputBuilder()
      .setCustomId(field.customId)
      .setStyle(field.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(field.required);

    if (field.placeholder) input.setPlaceholder(field.placeholder);
    if (field.minLength)   input.setMinLength(field.minLength);
    if (field.maxLength)   input.setMaxLength(field.maxLength);

    const label = new LabelBuilder()
      .setLabel(field.label)        // el label va AQUI
      .setTextInputComponent(input);

    if (field.description) label.setDescription(field.description);
    return label;
  });

  modal.addLabelComponents(...labels);
  return modal;
}

// ─── MODAL V2: REPORTAR ───────────────────────────────────────────────────────
export function buildReportarModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:reportar")
    .setTitle("Reporte de Usuario");

  // Label 1: StringSelect — tipo de prueba
  const tipoSelect = new StringSelectMenuBuilder()
    .setCustomId("tipo_prueba")
    .setPlaceholder("Selecciona el tipo de prueba que tienes...")
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Capturas de pantalla").setValue("capturas"),
      new StringSelectMenuOptionBuilder().setLabel("Video o grabacion").setValue("video"),
      new StringSelectMenuOptionBuilder().setLabel("Testigos presenciales").setValue("testigos"),
      new StringSelectMenuOptionBuilder().setLabel("Logs del servidor").setValue("logs"),
      new StringSelectMenuOptionBuilder().setLabel("Sin pruebas").setValue("sin_pruebas"),
    );
  const l1 = new LabelBuilder()
    .setLabel("Tipo de prueba disponible")
    .setDescription("Indica con que tipo de evidencia cuentas")
    .setStringSelectMenuComponent(tipoSelect);

  // Label 2: usuario reportado
  const l2 = new LabelBuilder()
    .setLabel("Usuario reportado")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("usuario_reportado")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Nombre#0000 o ID del usuario")
        .setRequired(true).setMinLength(2).setMaxLength(100)
    );

  // Label 3: motivo
  const l3 = new LabelBuilder()
    .setLabel("Motivo del reporte")
    .setDescription("Proporciona el mayor detalle posible")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("motivo")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe detalladamente el motivo del reporte...")
        .setRequired(true).setMinLength(20).setMaxLength(1000)
    );

  // Label 4: pruebas (opcional)
  const l4 = new LabelBuilder()
    .setLabel("Links de pruebas (opcional)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("pruebas")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("https://imgur.com/... o descripcion de las pruebas")
        .setRequired(false).setMaxLength(500)
    );

  modal.addLabelComponents(l1, l2, l3, l4);
  return modal;
}

// ─── MODAL V2: REPORTAR STAFF ─────────────────────────────────────────────────
export function buildReportarStaffModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:reportar_staff")
    .setTitle("Reporte de Staff");

  const gravSelect = new StringSelectMenuBuilder()
    .setCustomId("gravedad")
    .setPlaceholder("Selecciona la gravedad del incidente...")
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Leve — mal comportamiento puntual").setValue("leve"),
      new StringSelectMenuOptionBuilder().setLabel("Moderado — abuso de permisos").setValue("moderado"),
      new StringSelectMenuOptionBuilder().setLabel("Grave — acoso o discriminacion").setValue("grave"),
      new StringSelectMenuOptionBuilder().setLabel("Muy grave — corrupcion activa").setValue("muy_grave"),
    );

  const l1 = new LabelBuilder()
    .setLabel("Gravedad del incidente")
    .setDescription("Evalua la severidad de lo que ocurrio")
    .setStringSelectMenuComponent(gravSelect);

  const l2 = new LabelBuilder()
    .setLabel("Staff reportado")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("staff_reportado")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Nombre del miembro del staff")
        .setRequired(true).setMinLength(2).setMaxLength(100)
    );

  const l3 = new LabelBuilder()
    .setLabel("Descripcion del incidente")
    .setDescription("Se totalmente especifico con fechas y acciones")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("incidente")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe el comportamiento inadecuado del staff...")
        .setRequired(true).setMinLength(30).setMaxLength(1000)
    );

  const l4 = new LabelBuilder()
    .setLabel("Pruebas o testigos (opcional)")
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

// ─── MODAL V2: PETICION DE ROL ────────────────────────────────────────────────
export function buildPeticionRolModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:peticion_rol")
    .setTitle("Peticion de Rol");

  const l1 = new LabelBuilder()
    .setLabel("Rol solicitado")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("rol_solicitado")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Nombre exacto del rol")
        .setRequired(true).setMinLength(2).setMaxLength(100)
    );

  const l2 = new LabelBuilder()
    .setLabel("Motivo")
    .setDescription("Justifica tu solicitud con detalle")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("motivo")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Explica por que mereces o necesitas este rol...")
        .setRequired(true).setMinLength(20).setMaxLength(800)
    );

  const l3 = new LabelBuilder()
    .setLabel("Evidencia de requisitos")
    .setDescription("Sin pruebas no podemos procesar la solicitud")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("pruebas")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Links, capturas o descripcion de los requisitos cumplidos...")
        .setRequired(true).setMinLength(10).setMaxLength(500)
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

// ─── MODAL V2: EMPRESAS Y FACCION ─────────────────────────────────────────────
export function buildEmpresaFaccionModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ticket:modal:empresas_faccion")
    .setTitle("Solicitud de Empresa o Faccion");

  const tipoSelect = new StringSelectMenuBuilder()
    .setCustomId("tipo")
    .setPlaceholder("Tipo de organizacion...")
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Empresa legal").setValue("empresa"),
      new StringSelectMenuOptionBuilder().setLabel("Faccion / Banda").setValue("faccion"),
      new StringSelectMenuOptionBuilder().setLabel("Cartel").setValue("cartel"),
      new StringSelectMenuOptionBuilder().setLabel("Clan / Grupo").setValue("clan"),
      new StringSelectMenuOptionBuilder().setLabel("Organizacion independiente").setValue("independiente"),
    );

  const l1 = new LabelBuilder()
    .setLabel("Tipo de organizacion")
    .setDescription("Selecciona la categoria de tu organizacion")
    .setStringSelectMenuComponent(tipoSelect);

  const l2 = new LabelBuilder()
    .setLabel("Nombre")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("nombre")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Nombre de tu empresa o faccion")
        .setRequired(true).setMinLength(3).setMaxLength(100)
    );

  const l3 = new LabelBuilder()
    .setLabel("Descripcion")
    .setDescription("Explica que hace tu organizacion en el servidor")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("descripcion")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Proposito, actividades y objetivos de tu organizacion...")
        .setRequired(true).setMinLength(30).setMaxLength(800)
    );

  const l4 = new LabelBuilder()
    .setLabel("Miembros fundadores (opcional)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("miembros")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Lista los nombres de los miembros iniciales...")
        .setRequired(false).setMaxLength(400)
    );

  modal.addLabelComponents(l1, l2, l3, l4);
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
// discord.js aún no tiene FileUploadBuilder, usamos JSON raw de la API.
// Se envía via: await interaction.respond({ type: 9, data: buildRawXxxModal() })
// En el submit, los archivos llegan en: (interaction as any).resolved?.attachments

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

export function buildRawReportarModal() {
  return {
    title: "Reporte de Usuario",
    custom_id: "ticket:modal:reportar",
    components: [
      rawTextLabel("Usuario reportado", "usuario_reportado", 1, "Nombre#0000 o ID del usuario", true, 2, 100),
      rawTextLabel("Motivo del reporte", "motivo", 2, "Describe detalladamente el motivo...", true, 20, 1000),
      rawFileLabel("Pruebas (captura o archivo)", "Sube una imagen o archivo como evidencia (opcional)", "pruebas", false),
    ],
  };
}

export function buildRawReportarStaffModal() {
  return {
    title: "Reporte de Staff",
    custom_id: "ticket:modal:reportar_staff",
    components: [
      rawTextLabel("Staff reportado", "staff_reportado", 1, "Nombre del miembro del staff", true, 2, 100),
      rawTextLabel("Descripcion del incidente", "incidente", 2, "Describe el comportamiento inadecuado...", true, 30, 1000),
      rawTextLabel("Fecha y hora aproximada", "fecha_hora", 1, "Ej: 21/07/2026 a las 20:00", true, undefined, 100),
      rawFileLabel("Pruebas (captura o archivo)", "Sube evidencia visual del incidente (opcional)", "pruebas", false),
    ],
  };
}

export function buildRawPeticionRolModal() {
  return {
    title: "Peticion de Rol",
    custom_id: "ticket:modal:peticion_rol",
    components: [
      rawTextLabel("Rol que solicitas", "rol_solicitado", 1, "Nombre exacto del rol que deseas", true, 2, 100),
      rawTextLabel("Motivo de la solicitud", "motivo", 2, "Explica por que mereces o necesitas este rol...", true, 20, 800),
      rawFileLabel("Pruebas o requisitos cumplidos", "Sube una captura que demuestre que cumples los requisitos", "pruebas", true),
    ],
  };
}

export function buildRawComprasRealesModal() {
  return {
    title: "Gestion de Compra Real",
    custom_id: "ticket:modal:compras_reales",
    components: [
      rawTextLabel("Tipo de compra", "tipo_compra", 1, "Ej: Donacion, VIP, Rang, Robux, etc.", true, undefined, 100),
      rawTextLabel("Monto / Cantidad", "monto", 1, "Ej: $5 USD / 1000 Robux", true, undefined, 50),
      rawFileLabel("Comprobante de pago", "Sube la captura o comprobante de tu pago", "comprobante", true),
      rawTextLabel("Que esperas recibir", "que_esperas", 2, "Describe que beneficio, rol o item debes recibir...", true, 10, 400),
    ],
  };
}

export function buildRawReclamarSorteoModal() {
  return {
    title: "Reclamacion de Premio",
    custom_id: "ticket:modal:reclamar_sorteos",
    components: [
      rawTextLabel("Sorteo o evento ganado", "sorteo", 1, "Nombre del sorteo o descripcion del evento", true, 3, 200),
      rawTextLabel("Premio ganado", "premio", 1, "Describe el premio que ganaste", true, 3, 200),
      rawFileLabel("Prueba de que ganaste", "Sube la captura del mensaje donde ganaste o evidencia similar", "prueba_ganador", true),
    ],
  };
}
