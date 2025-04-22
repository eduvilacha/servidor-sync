import mongoose from 'mongoose';

const preguntaSchema = new mongoose.Schema({
  texto: { type: String, required: true }, // El texto de la pregunta
  opciones: [{ type: String, required: true }] // Las opciones de respuesta (un array de strings)
});

// Creamos el modelo Pregunta con el esquema definido
const Pregunta = mongoose.model("Pregunta", preguntaSchema);

export default Pregunta;
