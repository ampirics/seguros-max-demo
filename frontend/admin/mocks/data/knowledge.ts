import { COMPANY_ID } from "./common"

const at = "2026-08-20T14:00:00Z"
const item = (id: string, data: Record<string, any>) => ({
  id,
  company_id: COMPANY_ID,
  question: null,
  answer: null,
  is_active: true,
  created_at: at,
  updated_at: at,
  ...data,
})

export const knowledge = [
  item("kn-001", {
    type: "policy",
    title: "Cambios y devoluciones",
    content: "Aceptamos cambios dentro de 7 días con factura, si la pieza no fue instalada y conserva su empaque. Piezas eléctricas y pedidos especiales no tienen devolución.",
  }),
  item("kn-002", {
    type: "policy",
    title: "Garantía",
    content: "Las piezas tienen la garantía del fabricante contra defectos de fábrica. No cubre mala instalación ni desgaste normal. Se requiere la factura.",
  }),
  item("kn-003", {
    type: "policy",
    title: "Envíos y delivery",
    content: "Delivery en el Gran Santo Domingo el mismo día para pedidos pagados antes de las 2:00 p. m. Al interior se envía por Caribe Tours o Metro; el flete lo paga el cliente.",
  }),
  item("kn-004", {
    type: "term",
    title: "ITBIS",
    content: "Impuesto sobre la transferencia de bienes (18%). Los precios del catálogo no incluyen ITBIS.",
  }),
  item("kn-005", {
    type: "term",
    title: "Precio de taller",
    content: "Descuento para talleres registrados con RNC. Lo aplica un asesor; el bot no lo ofrece.",
  }),
  item("kn-006", {
    type: "faq",
    title: "Horario",
    content: "",
    question: "¿Cuál es el horario de la tienda?",
    answer: "Lunes a viernes de 8:00 a. m. a 6:00 p. m. y sábados de 8:00 a. m. a 1:00 p. m.",
  }),
  item("kn-007", {
    type: "faq",
    title: "Ubicación",
    content: "",
    question: "¿Dónde están ubicados?",
    answer: "En Villas Agrícolas, Santo Domingo. Teléfono 809-684-1243.",
  }),
  item("kn-008", {
    type: "faq",
    title: "Formas de pago",
    content: "",
    question: "¿Qué formas de pago aceptan?",
    answer: "Efectivo, tarjeta, transferencia (Popular, BHD, Banreservas) y link de pago por WhatsApp.",
  }),
  item("kn-009", {
    type: "faq",
    title: "Piezas para Kia",
    content: "",
    question: "¿Tienen piezas para Kia?",
    answer: "Sí. Muchas piezas Hyundai son compatibles con Kia; envíanos el año, modelo y motor para confirmar.",
    is_active: false,
  }),
]
