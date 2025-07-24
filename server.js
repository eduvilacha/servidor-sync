import express from 'express';
import session from 'express-session';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';

import cors from 'cors';

// Importar modelos
import Pregunta from './models/Preguntas.js';
import User from './models/User.js';
import Test from './models/Test.js';
import Like from './models/Like.js';

// Configuración inicial
dotenv.config();
console.log("NODE_ENV:", process.env.NODE_ENV);

const app = express();
import cookieParser from 'cookie-parser';
app.use(cookieParser());


app.set('trust proxy', 1);

// Conectar a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Conectado a MongoDB'))
  .catch((err) => console.error('Error al conectar a MongoDB:', err));

// Instancia de MongoStore
const mongoStore = MongoStore.create({
  mongoUrl: process.env.MONGO_URI,
  ttl: 24 * 60 * 60,
  autoRemove: 'native'
});

// Configuración de CORS
const allowedOrigins = [
  "http://localhost:5173",
  "https://sync-8dss.onrender.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origen no permitido'));
    }
  },
  credentials: true,
}));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "https://sync-8dss.onrender.com");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});


// Configuración de Express
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de la sesión
app.use(session({
  secret: process.env.SESSION_SECRET || '123abc',
  resave: false,
  saveUninitialized: false,
  store: mongoStore,
  cookie: {
    secure: true,
    sameSite: 'None',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  }
}));

// Middleware para debug de sesión
app.use((req, res, next) => {
  console.log(`[${req.method} ${req.path}] SessionID:`, req.sessionID);
  console.log(`[${req.method} ${req.path}] Session:`, req.session);
  next();
});

// ------------------------ RUTAS API ------------------------

// Ruta Home
app.get("/", (req, res) => {
  res.send("API de Syncronizados");
});

// Ruta de login (POST)
app.post("/login", async (req, res) => {
  const { nombre, contrasena } = req.body;
  try {
    const user = await User.findOne({ nombre });
    if (!user || user.contrasena !== contrasena) {
      console.log("Login fallido");
      return res.status(401).json({ success: false, message: "Usuario o contraseña incorrectos" });
    }
    req.session.usuario = { _id: user._id, nombre: user.nombre };
    req.session.save((err) => {
      if (err) {
        console.error("Error guardando sesión:", err);
        return res.status(500).json({ success: false, message: "Error al guardar sesión" });
      }
      res.status(200).json({ success: true });
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

// Ruta para logout (GET)
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al destruir sesión:", err);
      return res.status(500).json({ success: false, message: "Error al cerrar sesión" });
    }
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'None',
      secure: true,
    });
    res.status(200).json({ success: true, message: "Sesión cerrada" });
  });
});

// Ruta de registro (POST)
app.post("/register", async (req, res) => {
  const { nombre, edad, genero, provincia, contrasena } = req.body;
  try {
    const existingUser = await User.findOne({ nombre });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Este nombre de usuario ya está en uso." });
    }
    const newUser = new User({ nombre, edad, genero, provincia, contrasena });
    await newUser.save();
    res.status(201).json({ success: true, message: "Usuario registrado correctamente" });
  } catch (err) {
    console.error("Error en registro:", err);
    res.status(500).json({ success: false, message: "Error al registrar usuario" });
  }
});

// Ruta para verificar autenticación
app.get("/check-auth", async (req, res) => {

  if (req.session.usuario) {
    return res.json({
      isAuthenticated: true,
      userName: req.session.usuario.nombre,
    });
  } else {
    return res.json({ isAuthenticated: false });
  }
});


// Ruta para obtener perfil (GET)
app.get("/perfil", async (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }
  try {
    const usuario = await User.findById(req.session.usuario._id);
    res.json({
      success: true,
      nombre: usuario.nombre,
      edad: usuario.edad,
      genero: usuario.genero,
      provincia: usuario.provincia,
    });
  } catch (err) {
    console.error("Error perfil:", err);
    res.status(500).json({ success: false, message: "Error al cargar perfil" });
  }
});

// Ruta para actualizar perfil (POST)
app.post("/perfil", async (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }
  const { provincia, contrasena } = req.body;
  try {
    const usuario = await User.findById(req.session.usuario._id);
    if (provincia) usuario.provincia = provincia;
    if (contrasena) usuario.contrasena = contrasena;
    await usuario.save();
    res.json({ success: true, message: "Perfil actualizado" });
  } catch (err) {
    console.error("Error actualizar perfil:", err);
    res.status(500).json({ success: false, message: "Error al actualizar perfil" });
  }
});

// Ruta para top5 de compatibilidad
app.get("/top5", async (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).send("No autorizado");
  }
  try {
    const miTest = await Test.findOne({ usuario: req.session.usuario._id });
    if (!miTest) {
      return res.send("No has hecho el test aún.");
    }
    const otrosTests = await Test.find({ usuario: { $ne: req.session.usuario._id } }).populate("usuario");
    const compatibilidades = otrosTests.map(test => {
      const coincidencias = test.respuestas.filter((r, i) => r === miTest.respuestas[i]).length;
      const porcentaje = Math.round((coincidencias / miTest.respuestas.length) * 100);
      return { usuario: test.usuario, porcentaje };
    }).sort((a, b) => b.porcentaje - a.porcentaje).slice(0, 5);
    res.json(compatibilidades);
  } catch (error) {
    console.error("Error top5:", error);
    res.status(500).send("Error en top5");
  }
});

// Ruta para dar like
app.post("/like", async (req, res) => {
  if (!req.session.usuario) return res.status(401).send("No autorizado");
  const { targetUserId } = req.body;
  try {
    let like = await Like.findOne({ de: req.session.usuario._id, para: targetUserId });
    if (!like) {
      like = new Like({ de: req.session.usuario._id, para: targetUserId });
      await like.save();
    }
    const reciprocal = await Like.findOne({ de: targetUserId, para: req.session.usuario._id });
    if (reciprocal) {
      like.match = true;
      reciprocal.match = true;
      await like.save();
      await reciprocal.save();
    }
    res.send("Like registrado");
  } catch (err) {
    console.error("Error al dar like:", err);
    res.status(500).send("Error al dar like");
  }
});

app.get("/preguntas", async (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ message: "No autorizado" });
  }

  try {
    const preguntas = await Pregunta.find();
    res.json(preguntas);
  } catch (err) {
    console.error("Error al obtener preguntas:", err);
    res.status(500).json({ message: "Error al obtener preguntas" });
  }
});

app.post("/test", async (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  const { respuestas } = req.body;

  if (!Array.isArray(respuestas)) {
    return res.status(400).json({ success: false, message: "Formato de respuestas incorrecto" });
  }

  try {
    const existente = await Test.findOne({ usuario: req.session.usuario._id });
    if (existente) {
      existente.respuestas = respuestas;
      await existente.save();
    } else {
      const nuevo = new Test({ usuario: req.session.usuario._id, respuestas });
      await nuevo.save();
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error al guardar test:", err);
    res.status(500).json({ success: false, message: "Error al guardar test" });
  }
});

// Ruta para verificar si el usuario ya hizo el test
app.get("/test-realizado", async (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ realizado: false });
  }

  try {
    const test = await Test.findOne({ usuario: req.session.usuario._id });
    const yaHecho = test && Array.isArray(test.respuestas) && test.respuestas.length > 0;
    res.json({ realizado: yaHecho });
  } catch (err) {
    console.error("Error verificando test realizado:", err);
    res.status(500).json({ realizado: false });
  }
});



// Ruta no encontrada
app.use((req, res) => {
  console.log(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: 'Not Found' });
});




// Levantar servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
