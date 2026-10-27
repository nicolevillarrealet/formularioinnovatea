/* preguntas.js — Datos estáticos de los dos formularios.
   Cada pregunta es un objeto:
     id    clave corta con la que viaja la respuesta (r1, d5, e22…)
     n     número visible para el encuestado
     t     tipo de control: text | num | numna | select | multi | radio | inst
     l     enunciado
     o     opciones (radio, multi, select)
     x     opción excluyente dentro de un multi ("Ninguna" desmarca el resto)
     dep   id de la pregunta de la que depende un campo de institución
     show  función (respuestas) => bool, para preguntas condicionales
     opt   true si la pregunta es opcional
     buscar  en un select largo, muestra un buscador en vez del desplegable;
             el valor es el sustantivo plural que se lee ("municipios")

   Cada sección es una capa (un paso) del formulario. Por eso el formulario
   de rectores se divide en cuatro partes: así nadie enfrenta 28 preguntas
   de una vez. El orden de las columnas en la hoja no cambia.

   El formulario de docentes se arma en cuatro bloques porque las
   secciones 2 a 4 se repiten una vez por cada estudiante reportado. */

import { MUNICIPIOS, INSTITUCIONES, EPS, NIVEL, SN, SNS, SNI, EDADES, GRADOS } from "./catalogos.js";

const yes = (k) => (a) => a[k] === "Sí";

export const RECTORES={
  key:"rectores", title:"Rectores — Caracterización institucional y poblacional",
  sections:[{title:"Datos de quien responde",hint:"Solo la coordinación del proyecto conoce estos datos. No aparecen en los informes.",qs:[
    {id:"rn",n:"A",t:"text",l:"Nombre completo"},
    {id:"rc",n:"B",t:"text",l:"Correo electrónico o celular de contacto",opt:true},
  ]},{title:"Parte 1. La institución educativa", qs:[
    {id:"r1",n:1,t:"select",l:"¿En qué municipio se encuentra la institución educativa?",o:MUNICIPIOS,buscar:"municipios"},
    {id:"r2",n:2,t:"inst",l:"¿Cuál es la institución educativa?",dep:"r1"},
    {id:"r3",n:3,t:"radio",l:"¿Cuál es su cargo?",o:["Rector","Director rural","Coordinador","Otro directivo autorizado"]},
    {id:"r4",n:4,t:"radio",l:"¿Cuál es la zona de cobertura de la institución educativa?",o:["Urbana","Rural","Ambas"]},
    {id:"r5",n:5,t:"num",l:"¿Cuántos estudiantes están matriculados en básica primaria?"},
  ]},{title:"Parte 2. Población estudiantil", qs:[
    {id:"r6",n:6,t:"radio",l:"¿La institución tiene estudiantes con diagnóstico de autismo reportado?",o:["Sí","No","Información no disponible"]},
    {id:"r7",n:7,t:"num",l:"¿Cuántos estudiantes tienen diagnóstico de autismo con soporte documental disponible?",show:yes("r6")},
    {id:"r8",n:8,t:"num",l:"¿Cuántos tienen diagnóstico de autismo reportado por la familia, sin soporte documental disponible?",show:yes("r6")},
    {id:"r9",n:9,t:"num",l:"¿Cuántos estudiantes tienen diagnóstico documentado de TDAH?"},
    {id:"r10",n:10,t:"num",l:"¿Cuántos estudiantes tienen diagnóstico documentado de otras condiciones del neurodesarrollo?"},
    {id:"r11",n:11,t:"num",l:"¿Cuántos estudiantes autistas reportados son de sexo femenino?",show:yes("r6")},
    {id:"r12",n:12,t:"num",l:"¿Cuántos estudiantes autistas reportados son de sexo masculino?",show:yes("r6")},
    {id:"r13",n:13,t:"multi",l:"¿En qué grupos de edad se encuentran los estudiantes autistas?",o:EDADES,show:yes("r6")},
    {id:"r14",n:14,t:"multi",l:"¿En qué grados están matriculados?",o:GRADOS,show:yes("r6")},
    {id:"r15",n:15,t:"multi",l:"¿Qué condiciones del neurodesarrollo están reportadas en la institución?",o:["Autismo","TDAH","Discapacidad intelectual","Trastornos del lenguaje o comunicación","Trastornos del aprendizaje","Tics o Tourette","Otras","Ninguna"],x:"Ninguna"},
    {id:"r16",n:16,t:"num",l:"¿Cuántos estudiantes tienen un PIAR elaborado?"},
    {id:"r17",n:17,t:"num",l:"¿Cuántos estudiantes están registrados en SIMAT con alguna discapacidad?"},
  ]},{title:"Parte 3. Apoyos y articulación con salud", qs:[
    {id:"r18",n:18,t:"radio",l:"¿Se han identificado estudiantes que requieren orientación para valoración profesional?",o:SNS},
    {id:"r19",n:19,t:"radio",l:"¿La institución cuenta con docentes de apoyo pedagógico?",o:SN},
    {id:"r20",n:20,t:"radio",l:"¿La institución cuenta con orientador escolar?",o:SN},
    {id:"r21",n:21,t:"radio",l:"¿Con qué disponibilidad cuenta el personal de apoyo?",o:["Tiempo completo","Medio tiempo","Algunos días","No cuenta"]},
    {id:"r22",n:22,t:"multi",l:"¿Qué materiales o tecnologías de apoyo están disponibles?",o:["Apoyos visuales","Comunicación aumentativa o alternativa","Recursos digitales","Material sensorial","Material adaptado","Ninguno"],x:"Ninguno"},
    {id:"r23",n:23,t:"radio",l:"¿Existe una ruta institucional de orientación y remisión hacia servicios de salud?",o:["Sí","No","En construcción"]},
    {id:"r24",n:24,t:"radio",l:"¿Cuál es la principal dificultad de acceso a valoración en salud que conoce la institución?",o:["Distancia","Costos","Falta de especialistas","Trámites con EPS","Desconocimiento","No sabe"]},
  ]},{title:"Parte 4. Formación y necesidades institucionales", qs:[
    {id:"r25",n:25,t:"radio",l:"¿La institución ha desarrollado capacitaciones sobre autismo o neurodivergencias durante el año lectivo?",o:SNS},
    {id:"r26",n:26,t:"radio",l:"¿Cuántas capacitaciones se han desarrollado?",o:["1","2","3","4","5 o más"],show:yes("r25")},
    {id:"r27",n:27,t:"multi",l:"¿Qué entidades han participado en estas capacitaciones?",o:["Gobernación","Alcaldía","Instituciones de educación superior","Entidades de salud","Organizaciones sociales","Otras"],show:yes("r25")},
    {id:"r28",n:28,t:"multi",l:"¿Qué necesidades institucionales considera prioritarias?",o:["Formación docente","Personal de apoyo","Materiales accesibles","Articulación con salud","Orientación a familias","Accesibilidad"]},
  ]}],
  /* Las reglas de coherencia entre respuestas están en reglas.js. */
};

/* ---------- Formulario 2: Docentes ---------- */
export const DOC_ID={title:"Datos de quien responde",hint:"Solo la coordinación del proyecto conoce estos datos. No aparecen en los informes.",qs:[
  {id:"dn",n:"A",t:"text",l:"Nombre completo del docente"},
  {id:"dc",n:"B",t:"text",l:"Correo electrónico o celular de contacto",opt:true},
]};
export const DOC_GRUPO={title:"Sección 1. Identificación de la institución educativa y del docente", qs:[
  {id:"d1",n:1,t:"select",l:"¿En qué municipio se encuentra la institución educativa?",o:MUNICIPIOS,buscar:"municipios"},
  {id:"d2",n:2,t:"inst",l:"¿A qué institución educativa pertenece?",dep:"d1"},
  {id:"d3",n:3,t:"radio",l:"¿Qué grado de básica primaria tiene a cargo?",o:[...GRADOS,"Varios grados"]},
  {id:"d4",n:4,t:"num",l:"¿Cuántos estudiantes tiene a cargo?"},
  {id:"d5",n:5,t:"radio",l:"¿Tiene estudiantes con diagnóstico de autismo reportado en su grupo?",o:SNS},
  {id:"d6",n:6,t:"num",l:"¿Cuántos estudiantes con autismo reportado tiene en su grupo?",show:yes("d5")},
  {id:"d7",n:7,t:"radio",l:"¿Tiene estudiantes con otras condiciones del neurodesarrollo reportadas?",o:SNS},
  {id:"d8",n:8,t:"multi",l:"¿Cuáles condiciones han sido reportadas?",o:["TDAH","Discapacidad intelectual","Trastornos del aprendizaje","Trastornos del lenguaje","Tics o Tourette","Otras"],show:yes("d7")},
]};
export const DOC_ESTUDIANTE=[
 {title:"Sección 2. Caracterización sociodemográfica",hint:"Condiciones sociales y territoriales del estudiante. No escriba su nombre.",qs:[
  {id:"e9",n:9,t:"radio",l:"¿Cuál es el sexo registrado del estudiante?",o:["Femenino","Masculino","Información no disponible"]},
  {id:"e10",n:10,t:"radio",l:"¿En qué grupo de edad se encuentra el estudiante?",o:EDADES},
  {id:"e11",n:11,t:"radio",l:"¿En qué grado se encuentra matriculado?",o:GRADOS},
  {id:"e12",n:12,t:"radio",l:"¿Cuál es la pertenencia étnica registrada del estudiante?",o:["Indígena","Negro(a), afrocolombiano(a), raizal o palenquero(a)","Rrom o gitano(a)","Ninguno de los anteriores","Información no disponible"]},
  {id:"e13",n:13,t:"radio",l:"¿En qué zona reside el estudiante?",o:["Urbana","Rural","Información no disponible"]},
  {id:"e14",n:14,t:"radio",l:"¿Cuál es el estrato socioeconómico registrado del hogar del estudiante?",o:["Estrato 1","Estrato 2","Estrato 3","Estrato 4","Estrato 5","Estrato 6","Sin estratificación registrada","Información no disponible"]},
  {id:"e15",n:15,t:"radio",l:"¿El estudiante pertenece a población migrante internacional?",o:SNI},
  {id:"e16",n:16,t:"radio",l:"¿El estudiante se encuentra registrado como población afectada por desplazamiento forzado?",o:SNI},
  {id:"e17",n:17,t:"select",l:"¿Cuál es el último nivel educativo alcanzado por la madre o cuidadora principal?",o:NIVEL},
  {id:"e18",n:18,t:"select",l:"¿Cuál es el último nivel educativo alcanzado por el padre o cuidador principal?",o:NIVEL},
 ]},
 {title:"Sección 3. Condiciones de salud y acceso a servicios",qs:[
  {id:"e19",n:19,t:"select",l:"¿A qué EPS se encuentra afiliado el estudiante?",o:EPS},
  {id:"e20",n:20,t:"radio",l:"¿A qué régimen de afiliación en salud pertenece?",o:["Contributivo","Subsidiado","Especial o de excepción","No afiliado","Información no disponible"]},
  {id:"e21",n:21,t:"radio",l:"Si pertenece al régimen contributivo, ¿cuál es su condición de afiliación?",o:["Cotizante","Beneficiario","Información no disponible"],show:a=>a.e20==="Contributivo"},
  {id:"e22",n:22,t:"radio",l:"¿Cuál es la situación diagnóstica reportada del estudiante?",o:["Diagnóstico con soporte documental","Diagnóstico informado por la familia sin soporte disponible","En proceso de valoración","Sin diagnóstico reportado","Información no disponible"]},
  {id:"e23",n:23,t:"multi",l:"¿Qué condición o condiciones del neurodesarrollo se encuentran reportadas?",o:["Autismo","TDAH","Discapacidad intelectual","Trastornos del lenguaje o comunicación","Trastornos específicos del aprendizaje","Tics o Tourette","Otra","Ninguna"],x:"Ninguna"},
  {id:"e24",n:24,t:"radio",l:"¿El estudiante recibe actualmente acompañamiento terapéutico o atención profesional en salud, según la información conocida por el docente?",o:SNI},
  {id:"e25",n:25,t:"multi",l:"¿Qué tipos de atención profesional recibe el estudiante, según la información disponible?",o:["Psicología","Fonoaudiología","Terapia ocupacional","Medicina especializada","Fisioterapia","Otra"],show:yes("e24")},
  {id:"e26",n:26,t:"radio",l:"¿Se han identificado dificultades para acceder a servicios de valoración o atención en salud?",o:SNI},
  {id:"e27",n:27,t:"multi",l:"¿Cuáles son las dificultades de acceso conocidas?",o:["Distancia","Costos de transporte","Demoras de EPS","Falta de especialistas","Dificultades para obtener autorizaciones","Desconocimiento de rutas","Otras"],show:yes("e26")},
 ]},
 {title:"Sección 4. Permanencia y desescolarización",qs:[
  {id:"e28",n:28,t:"radio",l:"¿Cómo ha sido la asistencia escolar del estudiante durante el presente año lectivo?",o:["Regular","Presenta ausencias ocasionales","Presenta ausencias frecuentes","Información no disponible"]},
  {id:"e29",n:29,t:"radio",l:"¿Se han presentado interrupciones prolongadas en la asistencia escolar?",o:SNI},
  {id:"e30",n:30,t:"multi",l:"¿Cuáles han sido los principales motivos conocidos de inasistencia o interrupción escolar?",o:["Situaciones de salud","Dificultades de transporte","Barreras de accesibilidad","Dificultades económicas","Barreras de inclusión","Situaciones familiares","Desconocido","No aplica"],x:"No aplica"},
  {id:"e31",n:31,t:"radio",l:"¿El estudiante ha estado en riesgo de abandonar o interrumpir su proceso educativo durante el año lectivo?",o:SNS},
  {id:"e32",n:32,t:"multi",l:"¿Qué acciones se han implementado para favorecer su permanencia escolar?",o:["Seguimiento a la asistencia","Comunicación con la familia","Ajustes razonables","Flexibilización de actividades","Acompañamiento de orientación escolar","Articulación con entidades externas","Ninguna"],x:"Ninguna"},
 ]},
];
export const DOC_CIERRE=[
 {title:"Desescolarización en su institución",hint:"Preguntas 33 y 34 de la sección 4, sobre todos los estudiantes que conoce.",qs:[
  {id:"d33",n:33,t:"radio",l:"¿Durante los últimos 12 meses ha conocido casos de estudiantes con autismo u otras condiciones del neurodesarrollo que dejaron de asistir definitivamente a la institución educativa?",o:SNS},
  {id:"d34",n:34,t:"numna",l:"¿Cuántos casos de interrupción de escolaridad sin continuidad educativa conocida ha identificado en ese periodo?",show:yes("d33")},
 ]},
 {title:"Sección 5. Necesidades educativas y apoyos pedagógicos",qs:[
  {id:"d35",n:35,t:"multi",l:"¿Qué necesidades de apoyo identifica con mayor frecuencia en sus estudiantes?",o:["Comunicación","Interacción social","Atención","Organización de actividades","Regulación sensorial","Aprendizaje","Autonomía"]},
  {id:"d36",n:36,t:"multi",l:"¿Qué situaciones observa en estudiantes que podrían requerir orientación para valoración profesional?",o:["Dificultades persistentes de comunicación","Necesidad de apoyo en interacción","Conductas repetitivas","Sensibilidad sensorial","Dificultades de atención","Dificultades de aprendizaje","Ninguna"],x:"Ninguna"},
  {id:"d37",n:37,t:"multi",l:"¿Qué estrategias pedagógicas utiliza?",o:["Apoyos visuales","Instrucciones por pasos","Adaptación de actividades","Anticipación de rutinas","Flexibilización de tiempos","Apoyos sensoriales","Otras"]},
  {id:"d38",n:38,t:"radio",l:"¿Participa en la elaboración o implementación del PIAR cuando corresponde?",o:["Sí","No","No ha sido necesario","No sabe"]},
  {id:"d39",n:39,t:"multi",l:"¿Qué barreras afectan con mayor frecuencia la participación de estos estudiantes?",o:["Comunicativas","Sensoriales","Pedagógicas","Actitudinales","Falta de recursos","Falta de acompañamiento"]},
  {id:"d40",n:40,t:"radio",l:"¿Cuenta con acompañamiento de docentes de apoyo pedagógico?",o:["Siempre","Frecuentemente","Ocasionalmente","Nunca"]},
 ]},
 {title:"Sección 6. Formación y fortalecimiento de capacidades docentes",qs:[
  {id:"d41",n:41,t:"radio",l:"¿Cómo valora su preparación para implementar estrategias inclusivas?",o:["Muy preparado","Preparado","Poco preparado","Nada preparado"]},
  {id:"d42",n:42,t:"radio",l:"¿Ha recibido capacitación sobre autismo o neurodivergencias?",o:SN},
  {id:"d43",n:43,t:"radio",l:"¿Cuántas capacitaciones ha recibido durante los últimos dos años?",o:["1","2","3","4","5 o más"],show:yes("d42")},
  {id:"d44",n:44,t:"multi",l:"¿En qué temas relacionados con el autismo y otras neurodivergencias necesita fortalecer sus conocimientos?",o:["Autismo","TDAH","Estrategias pedagógicas inclusivas","PIAR","Comunicación aumentativa y alternativa","Regulación emocional y sensorial","Apoyo ante situaciones de crisis","Diseño Universal para el Aprendizaje","Trabajo con familias"]},
  {id:"d45",n:45,t:"multi",l:"¿Cuáles son las principales dificultades para implementar apoyos educativos?",o:["Tiempo","Formación","Recursos","Tamaño del grupo","Falta de acompañamiento","Articulación con familias"]},
  {id:"d46",n:46,t:"multi",l:"¿Qué acompañamiento considera más útil para mejorar la inclusión?",o:["Talleres prácticos","Asesoría en aula","Materiales pedagógicos","Acompañamiento interdisciplinario","Formación virtual","Comunidades de aprendizaje"]},
 ]},
];

/* ---------- Agrupaciones de conveniencia ---------- */

/** Secciones que se responden una sola vez, según el rol. */
export function seccionesGenerales(rol){
  return rol === "rectores" ? RECTORES.sections : [DOC_ID, DOC_GRUPO, ...DOC_CIERRE];
}

/** Secciones que se repiten una vez por ficha de estudiante (solo docentes). */
export function seccionesPorEstudiante(rol){
  return rol === "docentes" ? DOC_ESTUDIANTE : [];
}

/** Todas las preguntas de una lista de secciones, en orden. */
export function preguntasDe(secciones){
  return secciones.flatMap((s) => s.qs);
}

/** Índice id -> pregunta, para resolver etiquetas al exportar. */
export const INDICE = Object.fromEntries(
  [...preguntasDe(seccionesGenerales("rectores")),
   ...preguntasDe(seccionesGenerales("docentes")),
   ...preguntasDe(DOC_ESTUDIANTE)].map((q) => [q.id, q])
);

/** Encabezado legible para la hoja de cálculo: "12. ¿Cuántos…?" */
export function etiqueta(id){
  const q = INDICE[id];
  if (!q) return id;
  return `${q.n}. ${q.l}`;
}

export { INSTITUCIONES, MUNICIPIOS };
