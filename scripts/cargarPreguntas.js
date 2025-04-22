import mongoose from 'mongoose';
import dotenv from 'dotenv'; // Asegúrate de importar dotenv
import Pregunta from '../models/Preguntas.js'; // Asegúrate de tener la ruta correcta

// Cargar las variables de entorno
dotenv.config();  // Esto carga el archivo .env

//PREGUNTAS
const preguntas = [
    {
        texto: "¿Qué tan importante es para ti la comunicación?",
        opciones: ["Muy importante", "Algo importante", "Poco importante", "Nada importante"]
    },
    {
        texto: "¿Prefieres trabajar en equipo o individualmente?",
        opciones: ["Trabajo en equipo", "Trabajo individual", "Me da igual", "Depende del proyecto"]
    },
    {
        texto: "¿Te consideras una persona extrovertida?",
        opciones: ["Sí", "No", "A veces", "No estoy seguro"]
    },
    {
        texto: "¿Te gustaría viajar por trabajo?",
        opciones: ["Sí", "No", "Depende del destino", "Solo en vacaciones"]
    },
    {
        texto: "¿Qué tan importante es para ti la flexibilidad en el trabajo?",
        opciones: ["Muy importante", "Algo importante", "Poco importante", "Nada importante"]
    },
    {
        texto: "¿Qué tipo de música prefieres escuchar?",
        opciones: ["Rock", "Pop", "Reggetón", "Electrónica"]
    },
    {
        texto: "¿Cómo prefieres pasar tus vacaciones?",
        opciones: ["En la playa", "En la montaña", "Viajando a otra ciudad", "En un parque de aventuras"]
    },
    {
        texto: "¿Qué actividad prefieres hacer en tu tiempo libre?",
        opciones: ["Hacer deporte", "Leer", "Ver series", "Salir con amigos"]
    },
    {
        texto: "¿Cuál es tu deporte favorito?",
        opciones: ["Fútbol", "Baloncesto", "Tenis", "Balonmano", "¿Deporte? ¿se come?"]
    },
    {
        texto: "¿Qué género de películas te gusta más?",
        opciones: ["Ciencia Ficción", "Románticas", "Drama", "Comedia", "Terror"]
    },
    {
        texto: "¿Cómo prefieres organizar tu tiempo?",
        opciones: ["Soy de tenerlo todo planeado", "El freeStyle es mi modo de vida", "Soy flexible y trato de equilibrar planificación y espontaneidad"]
    },
    {
        texto: "¿Cómo prefieres pasar el fin de semana?",
        opciones: ["Visitar algún museo", "Salir de fiesta", "Quedar en casa", "Un picnic con amigos"]
    },
    {
        texto: "¿Qué clima prefieres?",
        opciones: ["Calor", "Frío", "Con lluvia"]
    },
    {
        texto: "¿Si fueras un superhéroe, ¿cuál sería tu superpoder?",
        opciones: ["Volar por todo el mundo", "Ser invisible cuando quiera", "Leer la mente de las personas", "Tener fuerza sobrehumana"]
    },
    {
        texto: "¿Qué tipo de comida es tu preferida?",
        opciones: ["Japonesa", "Española", "Italiana", "China"]
    }
];

// Función para cargar las preguntas
async function cargarPreguntas() {
  try {
    // Conectar a MongoDB usando la URI definida en las variables de entorno
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Conexión a MongoDB exitosa");

    // Borrar preguntas anteriores si ya existen en la base de datos
    await Pregunta.deleteMany({});

    // Insertar las nuevas preguntas
    await Pregunta.insertMany(preguntas);
    console.log('Preguntas cargadas correctamente');
    
    // Cerrar la conexión a MongoDB
    mongoose.disconnect();
  } catch (error) {
    console.error('Error al cargar preguntas:', error);
    mongoose.disconnect();
  }
}

// Ejecutar la función de cargar preguntas
cargarPreguntas();
