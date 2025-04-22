import mongoose from "mongoose";

// Definir el esquema de usuario
const userSchema = new mongoose.Schema({
    nombre: { type: String, required: true, unique: true },
    edad: { type: Number, required: true },
    genero: { type: String, required: true },
    provincia: { type: String, required: true },
    contrasena: { type: String, required: true },
    haHechoTest: { type: Boolean, default: false },
});

// Crear el modelo de usuario
const User = mongoose.model("User", userSchema);

export default User;

