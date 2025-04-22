import mongoose from "mongoose";

const testSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  respuestas: [Number] // array de números, uno por pregunta tipo test
});

const Test = mongoose.model("Test", testSchema);

export default Test;

