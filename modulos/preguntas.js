/* preguntas.js — Datos estáticos de los dos formularios.
   Cada pregunta es un objeto:
     id    clave corta con la que viaja la respuesta (r1, d5, e22…)
     n     número visible para el encuestado
     t     tipo de control: text | largo | tel | num | numna | select | multi | radio | inst
           (tel = celular colombiano de 10 dígitos)
           (largo = texto de varias líneas, hasta 500 caracteres)
     ayuda texto corto bajo el enunciado
     l     enunciado
     o     opciones (radio, multi, select)
     x     opción excluyente dentro de un multi ("Ninguna" desmarca el resto)
     dep   id de la pregunta de la que depende un campo de institución
     show  función (respuestas) => bool, para preguntas condicionales
     opt   true si la pregunta es opcional
     dentro  id de la pregunta en cuya MISMA pantalla aparece este campo
             (p. ej. el texto de "Otra" bajo las opciones); no tiene número
             propio en pantalla
     buscar  en un select largo, muestra un buscador en vez del desplegable;
             el valor es el sustantivo plural que se lee ("municipios")

   TRES FORMULARIOS (rol → tipo guardado → pestaña):
     rectores → "rector"  → Rectores
     apoyo    → "apoyo"   → Docentes de apoyo
     docentes → "docente" → Docentes
   Rectores y docentes de apoyo comparten las preguntas institucionales
   (claves r…). APOYO las tiene todas (1 a 18) y, si reporta estudiantes
   con TEA (6 = "Sí"), diligencia una ficha por cada uno (6.1 + 6.2).
   RECTORES es una copia sin los conteos de estudiantes (matrícula, TEA,
   sexo, edades, grados, TDAH, otras condiciones, PIAR, SIMAT, orientación
   a valoración), renumerada (1 a 12), y NO lleva fichas.

   NUMERACIÓN: toda pregunta que solo aparece por una respuesta anterior
   es una subpregunta de la que la abre (6.1, 8.1, 12.1, 16.1, 17.3…),
   también el texto que se pide al elegir "Otra"/"Otras". Así la
   secuencia principal nunca salta, responda lo que responda.

   DOCENTES: las preguntas del docente van numeradas en secuencia (1 a 18)
   en el orden en que se responden: Sección 1 (su grupo), 2
   (desescolarización), 3 (apoyos pedagógicos) y 4 (formación).

   La FICHA DE CARACTERIZACIÓN (DOC_ESTUDIANTE) va al final de los dos
   formularios, se repite una vez por cada estudiante con trastorno del
   espectro autista (TEA) y tiene numeración propia, F1 a F21 con
   subpreguntas (F12.1, F15.1, F16.1, F20.1), en tres partes:
   A (sociodemográfica), B (salud) y C (permanencia).

   Los id (d33, e9…) son los de la versión original del instrumento y no
   cambian: son las claves con que se guardan las respuestas. Solo cambia
   el número que se muestra. */

import { MUNICIPIOS, INSTITUCIONES, EPS, NIVEL, SN, SNS, SNI, EDADES, GRADOS } from "./catalogos.js";

const yes = (k) => (a) => a[k] === "Sí";
const masDe0 = (k) => (a) => typeof a[k] === "number" && a[k] > 0;

/* Nombres completos: las siglas nunca van solas. */
export const TEA = "Trastorno del espectro autista (TEA)";
export const TDAH = "Trastorno por déficit de atención e hiperactividad (TDAH)";
const PIAR = "Plan Individual de Ajustes Razonables (PIAR)";
const GRADOS_APOYO = ["Preescolar", ...GRADOS];

/** Opciones que cambiaron de nombre: las respuestas guardadas con el
    nombre anterior se leen con el nuevo (borradores y hoja reorganizada). */
export const ALIAS = {
  "Autismo": TEA,
  "TDAH": TDAH,
  "PIAR": PIAR,
  "Trámites con EPS": "Trámites con la Entidad Promotora de Salud (EPS)",
  "Demoras de EPS": "Demoras de la Entidad Promotora de Salud (EPS)",
  "No cuenta": "No cuenta con disponibilidad",
};

export const APOYO={
  key:"apoyo", title:"Docentes de apoyo — Caracterización institucional y poblacional",
  sections:[{title:"Datos de quien responde",qs:[
    {id:"rn",n:"A",t:"text",l:"Nombre completo"},
    {id:"rc",n:"B",t:"tel",l:"Celular de contacto",ayuda:"Su correo ya quedó registrado al verificarlo; aquí no hace falta repetirlo.",opt:true},
  ]},{title:"Parte 1. La institución educativa", qs:[
    {id:"r1",n:1,t:"select",l:"¿En qué municipio se encuentra la institución educativa?",o:MUNICIPIOS,buscar:"municipios"},
    {id:"r2",n:2,t:"inst",l:"¿Cuál es la institución educativa?",dep:"r1"},
    {id:"r3",n:3,t:"radio",l:"¿Cuál es su cargo?",o:["Docente de apoyo","Rector","Director rural","Coordinador","Otro directivo autorizado"]},
    {id:"r4",n:4,t:"radio",l:"¿Cuál es la zona de cobertura de la institución educativa?",o:["Urbana","Rural"]},
    {id:"r5",n:5,t:"num",l:"¿Cuántos estudiantes están matriculados en básica primaria?"},
  ]},{title:"Parte 2. Población estudiantil", qs:[
    {id:"r6",n:6,t:"radio",l:"¿La institución tiene estudiantes con diagnóstico de trastorno del espectro autista (TEA) reportado?",o:["Sí","No","Información no disponible"],ayuda:"Si responde «Sí», al final de la encuesta diligenciará una ficha de caracterización por cada uno de esos estudiantes."},
    {id:"r7",n:"6.1",t:"num",l:"¿Cuántos estudiantes tienen diagnóstico de trastorno del espectro autista (TEA) con soporte documental disponible?",show:yes("r6")},
    {id:"r8",n:"6.2",t:"num",l:"¿Cuántos tienen diagnóstico de trastorno del espectro autista (TEA) reportado por la familia, sin soporte documental disponible?",show:yes("r6")},
    {id:"r11",n:"6.3",t:"num",l:"¿Cuántos estudiantes con trastorno del espectro autista (TEA) reportado son de sexo femenino?",show:yes("r6")},
    {id:"r12",n:"6.4",t:"num",l:"¿Cuántos estudiantes con trastorno del espectro autista (TEA) reportado son de sexo masculino?",show:yes("r6")},
    {id:"r13",n:"6.5",t:"multi",l:"¿En qué grupos de edad se encuentran los estudiantes con trastorno del espectro autista (TEA)?",o:EDADES,show:yes("r6")},
    {id:"r14",n:"6.6",t:"multi",l:"¿En qué grados están matriculados?",o:GRADOS_APOYO,show:yes("r6")},
    {id:"r9",n:7,t:"num",l:"¿Cuántos estudiantes tienen diagnóstico documentado de trastorno por déficit de atención e hiperactividad (TDAH)?"},
    {id:"r10",n:8,t:"num",l:"¿Cuántos estudiantes tienen diagnóstico documentado de otras condiciones del neurodesarrollo?"},
    {id:"r10c",n:"8.1",t:"largo",l:"¿Cuáles son esas otras condiciones del neurodesarrollo documentadas?",ayuda:"Escríbalas separadas por comas. Por ejemplo: discapacidad intelectual, trastorno del lenguaje.",show:masDe0("r10")},
    {id:"r16",n:9,t:"num",l:"¿Cuántos estudiantes tienen un Plan Individual de Ajustes Razonables (PIAR) elaborado?"},
    {id:"r17",n:10,t:"num",l:"¿Cuántos estudiantes están registrados en el Sistema Integrado de Matrícula (SIMAT) con alguna neurodivergencia?"},
  ]},{title:"Parte 3. Apoyos y articulación con salud", qs:[
    {id:"r18",n:11,t:"radio",l:"¿Se han identificado estudiantes que requieren orientación para valoración profesional?",o:SNS},
    {id:"r19",n:12,t:"radio",l:"¿La institución cuenta con docentes de apoyo pedagógico?",o:SN},
    {id:"r21",n:"12.1",t:"multi",l:"¿Con qué disponibilidad cuenta el personal de apoyo?",o:["Tiempo completo","Medio tiempo","Algunos días","No cuenta con disponibilidad"],x:"No cuenta con disponibilidad",show:yes("r19")},
    {id:"r20",n:13,t:"radio",l:"¿La institución cuenta con orientador escolar?",o:SN},
    {id:"r22",n:14,t:"multi",l:"¿Qué materiales o tecnologías de apoyo están disponibles?",o:["Apoyos visuales","Comunicación aumentativa o alternativa","Recursos digitales","Material sensorial","Material adaptado","Ninguno"],x:"Ninguno"},
    {id:"r23",n:15,t:"radio",l:"¿Existe una ruta institucional de orientación y remisión hacia servicios de salud?",o:["Sí","No","En construcción"]},
    {id:"r24",n:16,t:"radio",l:"¿Cuál es la principal dificultad de acceso a valoración en salud que conoce la institución?",o:["Distancia","Costos","Falta de especialistas","Trámites con la Entidad Promotora de Salud (EPS)","Desconocimiento","No sabe","Otra"]},
    {id:"r24o",n:"16.1",t:"text",l:"Describa cuál es la otra dificultad de acceso a valoración en salud que conoce.",show:(a)=>a.r24==="Otra"},
  ]},{title:"Parte 4. Formación y necesidades institucionales", qs:[
    {id:"r25",n:17,t:"radio",l:"¿La institución ha desarrollado capacitaciones sobre trastorno del espectro autista (TEA) o neurodivergencias durante el año lectivo?",o:SNS},
    {id:"r26",n:"17.1",t:"radio",l:"¿Cuántas capacitaciones se han desarrollado?",o:["1","2","3","4","5 o más"],show:yes("r25")},
    {id:"r27",n:"17.2",t:"multi",l:"¿Qué entidades han participado en estas capacitaciones?",o:["Gobernación","Alcaldía","Instituciones de educación superior","Entidades de salud","Organizaciones sociales","Otras"],show:yes("r25")},
    {id:"r27o",n:"17.3",t:"text",l:"Escriba el nombre de las entidades que han participado en dichas capacitaciones.",ayuda:"Si son varias, sepárelas con comas.",show:(a)=>a.r25==="Sí"&&(a.r27||[]).includes("Otras")},
    {id:"r28",n:18,t:"multi",l:"¿Qué necesidades institucionales considera prioritarias?",o:["Formación docente","Personal de apoyo","Materiales accesibles","Articulación con salud","Orientación a familias","Accesibilidad"]},
  ]}],
  /* Las reglas de coherencia entre respuestas están en reglas.js. */
};

/* ---------- Formulario de rectores: copia del de docentes de apoyo ---------- */

/* Preguntas del formulario de docentes de apoyo que NO van en el de
   rectores, y la numeración que toma cada una de las que quedan. */
const SIN_RECTOR = new Set(["r5", "r7", "r8", "r11", "r12", "r13", "r14", "r9", "r10", "r10c", "r16", "r17", "r18"]);
const NUM_RECTOR = {
  r6: 5, r19: 6, r21: "6.1", r20: 7, r22: 8, r23: 9, r24: 10, r24o: "10.1",
  r25: 11, r26: "11.1", r27: "11.2", r27o: "11.3", r28: 12,
};
export const RECTORES = {
  key: "rectores",
  title: "Rectores — Caracterización institucional y poblacional",
  sections: APOYO.sections.map((sec) => ({
    ...sec,
    qs: sec.qs.filter((q) => !SIN_RECTOR.has(q.id)).map((q) => {
      const c = { ...q, n: q.id in NUM_RECTOR ? NUM_RECTOR[q.id] : q.n };
      if (q.id === "r3") c.o = q.o.filter((o) => o !== "Docente de apoyo");
      if (q.id === "r6") delete c.ayuda; // los rectores no llenan fichas
      if (q.id === "r21") c.l = "¿Con qué disponibilidad cuenta el personal de apoyo pedagógico?";
      return c;
    }),
  })),
};

/* ---------- Formulario 3: Docentes ---------- */
export const DOC_ID={title:"Datos de quien responde",qs:[
  {id:"dn",n:"A",t:"text",l:"Nombre completo del docente"},
  {id:"dc",n:"B",t:"tel",l:"Celular de contacto",ayuda:"Su correo ya quedó registrado al verificarlo; aquí no hace falta repetirlo.",opt:true},
]};
export const DOC_GRUPO={title:"Sección 1. Identificación de la institución educativa y del docente", qs:[
  {id:"d1",n:1,t:"select",l:"¿En qué municipio se encuentra la institución educativa?",o:MUNICIPIOS,buscar:"municipios"},
  {id:"d2",n:2,t:"inst",l:"¿A qué institución educativa pertenece?",dep:"d1"},
  {id:"d3",n:3,t:"radio",l:"¿Qué grado de básica primaria tiene a cargo?",o:[...GRADOS,"Varios grados"]},
  {id:"d4",n:4,t:"num",l:"¿Cuántos estudiantes tiene a cargo?"},
  {id:"d5",n:5,t:"radio",l:"¿Tiene estudiantes con diagnóstico de trastorno del espectro autista (TEA) reportado en su grupo?",o:SNS,ayuda:"Si responde «Sí», al final de la encuesta diligenciará una ficha de caracterización por cada uno de esos estudiantes."},
  {id:"d6",n:"5.1",t:"num",l:"¿Cuántos estudiantes con trastorno del espectro autista (TEA) reportado tiene en su grupo?",show:yes("d5")},
  {id:"d7",n:6,t:"radio",l:"¿Tiene estudiantes con otras condiciones del neurodesarrollo reportadas?",o:SNS},
  {id:"d8",n:"6.1",t:"multi",l:"¿Cuáles condiciones han sido reportadas?",o:[TDAH,"Discapacidad intelectual","Trastornos del aprendizaje","Trastornos del lenguaje","Tics o Tourette","Otras"],show:yes("d7")},
]};
export const DOC_ESTUDIANTE=[
 {title:"Parte A. Caracterización sociodemográfica",hint:"Condiciones sociales y territoriales del estudiante. No escriba su nombre.",qs:[
  {id:"e9",n:"F1",t:"radio",l:"¿Cuál es el sexo registrado del estudiante?",o:["Femenino","Masculino","Información no disponible"]},
  {id:"e10",n:"F2",t:"radio",l:"¿En qué grupo de edad se encuentra el estudiante?",o:EDADES},
  {id:"e11",n:"F3",t:"radio",l:"¿En qué grado se encuentra matriculado?",o:GRADOS_APOYO},
  {id:"e12",n:"F4",t:"radio",l:"¿Cuál es la pertenencia étnica registrada del estudiante?",o:["Indígena","Afrocolombiano(a), raizal o palenquero(a)","Rrom o gitano(a)","Ninguno de los anteriores","Información no disponible"]},
  {id:"e13",n:"F5",t:"radio",l:"¿En qué zona reside el estudiante?",o:["Urbana","Rural","Información no disponible"]},
  {id:"e14",n:"F6",t:"radio",l:"¿Cuál es el estrato socioeconómico registrado del hogar del estudiante?",o:["Estrato 1","Estrato 2","Estrato 3","Estrato 4","Estrato 5","Estrato 6","Sin estratificación registrada","Información no disponible"]},
  {id:"e15",n:"F7",t:"radio",l:"¿El estudiante pertenece a población migrante internacional?",o:SNI},
  {id:"e16",n:"F8",t:"radio",l:"¿El estudiante se encuentra registrado como población afectada por desplazamiento forzado?",o:SNI},
  {id:"e17",n:"F9",t:"select",l:"¿Cuál es el último nivel educativo alcanzado por la madre o cuidadora principal?",o:NIVEL},
  {id:"e18",n:"F10",t:"select",l:"¿Cuál es el último nivel educativo alcanzado por el padre o cuidador principal?",o:NIVEL},
 ]},
 {title:"Parte B. Condiciones de salud y acceso a servicios",qs:[
  {id:"e19",n:"F11",t:"select",l:"¿A qué Entidad Promotora de Salud (EPS) se encuentra afiliado el estudiante?",o:EPS},
  {id:"e20",n:"F12",t:"radio",l:"¿A qué régimen de afiliación en salud pertenece?",o:["Contributivo","Subsidiado","Especial o de excepción","No afiliado","Información no disponible"]},
  {id:"e21",n:"F12.1",t:"radio",l:"Si pertenece al régimen contributivo, ¿cuál es su condición de afiliación?",o:["Cotizante","Beneficiario","Información no disponible"],show:a=>a.e20==="Contributivo"},
  {id:"e22",n:"F13",t:"radio",l:"¿Cuál es la situación diagnóstica reportada del estudiante?",o:["Diagnóstico con soporte documental","Diagnóstico informado por la familia sin soporte disponible","En proceso de valoración","Sin diagnóstico reportado","Información no disponible"]},
  {id:"e23",n:"F14",t:"multi",l:"¿Qué condición o condiciones del neurodesarrollo se encuentran reportadas?",o:[TEA,TDAH,"Discapacidad intelectual","Trastornos del lenguaje o comunicación","Trastornos específicos del aprendizaje","Tics o Tourette","Otra","Ninguna"],x:"Ninguna"},
  {id:"e24",n:"F15",t:"radio",l:"¿El estudiante recibe actualmente acompañamiento terapéutico o atención profesional en salud, según la información conocida por el docente?",o:SNI},
  {id:"e25",n:"F15.1",t:"multi",l:"¿Qué tipos de atención profesional recibe el estudiante, según la información disponible?",o:["Psicología","Fonoaudiología","Terapia ocupacional","Medicina especializada","Fisioterapia","Otra"],show:yes("e24")},
  {id:"e26",n:"F16",t:"radio",l:"¿Se han identificado dificultades para acceder a servicios de valoración o atención en salud?",o:SNI},
  {id:"e27",n:"F16.1",t:"multi",l:"¿Cuáles son las dificultades de acceso conocidas?",o:["Distancia","Costos de transporte","Demoras de la Entidad Promotora de Salud (EPS)","Falta de especialistas","Dificultades para obtener autorizaciones","Desconocimiento de rutas","Otras","Información no disponible"],x:"Información no disponible",show:yes("e26")},
 ]},
 {title:"Parte C. Permanencia y desescolarización",qs:[
  {id:"e28",n:"F17",t:"radio",l:"¿Cómo ha sido la asistencia escolar del estudiante durante el presente año lectivo?",o:["Regular","Presenta ausencias ocasionales","Presenta ausencias frecuentes","Información no disponible"]},
  {id:"e29",n:"F18",t:"radio",l:"¿Se han presentado interrupciones prolongadas en la asistencia escolar?",o:SNI},
  {id:"e30",n:"F19",t:"multi",l:"¿Cuáles han sido los principales motivos conocidos de inasistencia o interrupción escolar?",o:["Situaciones de salud","Dificultades de transporte","Barreras de accesibilidad","Dificultades económicas","Barreras de inclusión","Situaciones familiares","Desconocido","No aplica"],x:"No aplica"},
  {id:"e31",n:"F20",t:"radio",l:"¿El estudiante ha estado en riesgo de abandonar o interrumpir su proceso educativo durante el año lectivo?",o:SNS},
  {id:"e31j",n:"F20.1",t:"largo",l:"¿Por qué ha estado en riesgo? Explique brevemente la situación.",ayuda:"Sin nombres ni datos que permitan identificar al estudiante o a su familia.",show:yes("e31")},
  {id:"e32",n:"F21",t:"multi",l:"¿Qué acciones se han implementado para favorecer su permanencia escolar?",o:["Seguimiento a la asistencia","Comunicación con la familia","Ajustes razonables","Flexibilización de actividades","Acompañamiento de orientación escolar","Articulación con entidades externas","Ninguna"],x:"Ninguna"},
 ]},
];
export const DOC_CIERRE=[
 {title:"Sección 2. Desescolarización en su institución",hint:"Sobre todos los estudiantes que conoce en la institución, no solo los de su grupo.",qs:[
  {id:"d33",n:7,t:"radio",l:"¿Durante los últimos 12 meses ha conocido casos de estudiantes con trastorno del espectro autista (TEA) u otras condiciones del neurodesarrollo que dejaron de asistir definitivamente a la institución educativa?",o:SNS},
  {id:"d34",n:"7.1",t:"numna",l:"¿Cuántos casos de interrupción de escolaridad sin continuidad educativa conocida ha identificado en ese periodo?",show:yes("d33")},
 ]},
 {title:"Sección 3. Necesidades educativas y apoyos pedagógicos",qs:[
  {id:"d35",n:8,t:"multi",l:"¿Qué necesidades de apoyo identifica con mayor frecuencia en sus estudiantes?",o:["Comunicación","Interacción social","Atención","Organización de actividades","Regulación sensorial","Aprendizaje","Autonomía"]},
  {id:"d36",n:9,t:"multi",l:"¿Qué situaciones observa en estudiantes que podrían requerir orientación para valoración profesional?",o:["Dificultades persistentes de comunicación","Necesidad de apoyo en interacción","Conductas repetitivas","Sensibilidad sensorial","Dificultades de atención","Dificultades de aprendizaje","Ninguna"],x:"Ninguna"},
  {id:"d37",n:10,t:"multi",l:"¿Qué estrategias pedagógicas utiliza?",o:["Apoyos visuales","Instrucciones por pasos","Adaptación de actividades","Anticipación de rutinas","Flexibilización de tiempos","Apoyos sensoriales","Otras"]},
  {id:"d38",n:11,t:"radio",l:"¿Participa en la elaboración o implementación del Plan Individual de Ajustes Razonables (PIAR) cuando corresponde?",o:["Sí","No","No ha sido necesario","No sabe"]},
  {id:"d39",n:12,t:"multi",l:"¿Qué barreras afectan con mayor frecuencia la participación de estos estudiantes?",o:["Comunicativas","Sensoriales","Pedagógicas","Actitudinales","Falta de recursos","Falta de acompañamiento"]},
  {id:"d40",n:13,t:"radio",l:"¿Cuenta con acompañamiento de docentes de apoyo pedagógico?",o:["Siempre","Frecuentemente","Ocasionalmente","Nunca"]},
 ]},
 {title:"Sección 4. Formación y fortalecimiento de capacidades docentes",qs:[
  {id:"d41",n:14,t:"radio",l:"¿Cómo valora su preparación para implementar estrategias inclusivas?",o:["Muy preparado","Preparado","Poco preparado","Nada preparado"]},
  {id:"d42",n:15,t:"radio",l:"¿Ha recibido capacitación sobre trastorno del espectro autista (TEA) o neurodivergencias?",o:SN},
  {id:"d43",n:"15.1",t:"radio",l:"¿Cuántas capacitaciones ha recibido durante los últimos dos años?",o:["1","2","3","4","5 o más"],show:yes("d42")},
  {id:"d44",n:16,t:"multi",l:"¿En qué temas relacionados con el trastorno del espectro autista (TEA) y otras neurodivergencias necesita fortalecer sus conocimientos?",o:[TEA,TDAH,"Estrategias pedagógicas inclusivas",PIAR,"Comunicación aumentativa y alternativa","Regulación emocional y sensorial","Apoyo ante situaciones de crisis","Diseño Universal para el Aprendizaje","Trabajo con familias"]},
  {id:"d45",n:17,t:"multi",l:"¿Cuáles son las principales dificultades para implementar apoyos educativos?",o:["Tiempo","Formación","Recursos","Tamaño del grupo","Falta de acompañamiento","Articulación con familias"]},
  {id:"d46",n:18,t:"multi",l:"¿Qué acompañamiento considera más útil para mejorar la inclusión?",o:["Talleres prácticos","Asesoría en aula","Materiales pedagógicos","Acompañamiento interdisciplinario","Formación virtual","Comunidades de aprendizaje"]},
 ]},
];

/* ---------- Agrupaciones de conveniencia ---------- */

/** ¿Formulario institucional (rectores o docentes de apoyo)? */
export const esInstitucional = (rol) => rol === "rectores" || rol === "apoyo";

/** Tipo que se guarda en cada envío, según el formulario. */
export const TIPO = { rectores: "rector", apoyo: "apoyo", docentes: "docente" };

/** Secciones que se responden una sola vez, según el rol. */
export function seccionesGenerales(rol){
  if (rol === "rectores") return RECTORES.sections;
  if (rol === "apoyo") return APOYO.sections;
  return [DOC_ID, DOC_GRUPO, ...DOC_CIERRE];
}

/** Secciones según el tipo guardado en un envío. */
export const seccionesDeTipo = (tipo) => seccionesGenerales(
  Object.keys(TIPO).find((rol) => TIPO[rol] === tipo) || "docentes");

/** Secciones que se repiten una vez por ficha de estudiante (los dos formularios). */
export function seccionesPorEstudiante(){
  return DOC_ESTUDIANTE;
}

/** Nombre visible de cada encuesta, según el tipo guardado. */
export const NOMBRE_ENCUESTA = { rector: "rector", apoyo: "docente de apoyo", docente: "docente" };

/** Todas las preguntas de una lista de secciones, en orden. */
export function preguntasDe(secciones){
  return secciones.flatMap((s) => s.qs);
}

/** Índice id -> pregunta, para resolver etiquetas al exportar. */
export const INDICE = Object.fromEntries(
  [...preguntasDe(seccionesGenerales("apoyo")),
   ...preguntasDe(seccionesGenerales("docentes")),
   ...preguntasDe(DOC_ESTUDIANTE)].map((q) => [q.id, q])
);

/** Encabezado legible para la hoja de cálculo: "12. ¿Cuántos…?".
    Recibe la pregunta (con la numeración de su formulario) o su id. */
export function etiqueta(q){
  if (typeof q === "string") q = INDICE[q];
  if (!q) return "";
  return `${q.n}. ${q.l}`;
}

export { INSTITUCIONES, MUNICIPIOS };
