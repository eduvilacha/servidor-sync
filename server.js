import express from 'express';
import session from 'express-session';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

// Importar los modelos
import Pregunta from './models/Preguntas.js';
import User from './models/User.js';
import Test from './models/Test.js';
import Like from './models/Like.js';

dotenv.config();
console.log("NODE_ENV:", process.env.NODE_ENV);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Conectar a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Conectado a MongoDB'))
  .catch((err) => console.error('Error al conectar a MongoDB:', err));

// Crear instancia de mongoStore
const mongoStore = MongoStore.create({
  mongoUrl: process.env.MONGO_URI,
  ttl: 24 * 60 * 60,
  autoRemove: 'native'
});

// -------- CONFIGURACIÓN --------

// Configurar CORS bien
const allowedOrigins = [
  "http://localhost:5173",
  "https://syncronizados.netlify.app"
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

// Configurar Express
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configurar Sesiones
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

// Middleware de debug de cookies y sesión
app.use((req, res, next) => {
  console.log(`[${req.method} ${req.path}] Cookie recibida:`, req.headers.cookie);
  console.log(`[${req.method} ${req.path}] Sesión:`, req.session);
  next();
});




// -------------------------RUTAS-------------------------------

// Ruta principal
app.get("/", (req, res) => {
  if (!req.session.usuario) {
    return res.redirect("/login");
  }
  res.render("index", { usuario: req.session.usuario });
});

// Ruta de login (GET)
app.get("/login", (req, res) => {
  if (req.session.usuario) {
    return res.redirect("/");
  }
  res.render("login");
});

// Ruta de registro (GET)
app.get("/register", (req, res) => {
  res.render("register");
});

// Ruta de registro (POST)
app.post("/register", async (req, res) => {
  const { nombre, edad, genero, provincia, contrasena } = req.body;

  try {
    const existingUser = await User.findOne({ nombre });
    if (existingUser) {
      console.log("Este nombre de usuario ya está en uso.");
      return res.status(400).json({ success: false, message: "Este nombre de usuario ya está en uso." });
    }

    const newUser = new User({
      nombre,
      edad,
      genero,
      provincia,
      contrasena
    });

    await newUser.save();
    res.status(201).json({ success: true, message: "Usuario registrado correctamente." });
  } catch (err) {
    console.error("Error en /register:", err);
    res.status(500).json({ success: false, message: "Error al registrar el usuario." });
  }
});

// Ruta de login (POST)
app.post("/login", async (req, res) => {
  const { nombre, contrasena } = req.body;

  try {
    const user = await User.findOne({ nombre });

    if (!user || user.contrasena !== contrasena) {
      console.log("Error en /login: Usuario o contraseña incorrectos");
      return res.status(401).json({ success: false, message: "Usuario o contraseña incorrectos" });
    }

    req.session.usuario = {
      _id: user._id,
      nombre: user.nombre
    };

    console.log("Sesión establecida en /login:", req.session);
    console.log("SessionID en /login:", req.sessionID);

    req.session.save((err) => {
      if (err) {
        console.error("Error al guardar sesión:", err);
        return res.status(500).json({ success: false, message: "Error al guardar sesión" });
      }
      res.status(200).json({ success: true });
    });
    
  } catch (err) {
    console.error("Error en /login:", err);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});


// Ruta de logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al destruir la sesión:', err);
      return res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
    }
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'None',
      secure: true,
    });
    
    res.status(200).json({ success: true, message: 'Sesión cerrada' });
  });
});

// Ruta para el test
app.get("/test", async (req, res) => {
  const user = await User.findById(req.session.usuario?._id);

  if (user && user.haHechoTest) {
    return res.redirect("/testCompletado");
  }

  try {
    const preguntas = await Pregunta.find();
    res.render("test", { preguntas });
  } catch (err) {
    console.error("Error al obtener las preguntas:", err);
    res.send("Hubo un error al cargar las preguntas.");
  }
});

// Procesar respuestas del test
app.post('/test', async (req, res) => {
  try {
    const respuestas = req.body.respuestas;
    const usuario = await User.findById(req.session.usuario._id);

    const nuevoTest = new Test({
      usuario: usuario._id,
      respuestas: respuestas,
    });

    await nuevoTest.save();

    await User.updateOne(
      { _id: usuario._id },
      { $set: { haHechoTest: true } }
    );

    res.redirect("/testCompletado");
  } catch (error) {
    console.error("Error al guardar el test:", error);
    res.send("Hubo un error al procesar el test");
  }
});

// Ruta para test completado
app.get("/testCompletado", (req, res) => {
  if (!req.session.usuario) {
    return res.redirect("/login");
  }
  res.render("testCompletado", { usuario: req.session.usuario });
});

// Ruta para perfil (GET)
app.get("/perfil", async (req, res) => {
  if (!req.session.usuario) {
    return res.redirect("/login");
  }

  try {
    const usuario = await User.findById(req.session.usuario._id);
    res.render("perfil", { usuario });
  } catch (err) {
    console.error("Error al cargar perfil:", err);
    res.send("Error al cargar perfil");
  }
});

// Ruta para perfil (POST)
app.post("/perfil", async (req, res) => {
  if (!req.session.usuario) {
    return res.redirect("/login");
  }

  const { provincia, contrasena } = req.body;

  try {
    const usuario = await User.findById(req.session.usuario._id);

    if (!usuario) {
      return res.redirect("/login");
    }

    if (provincia) {
      usuario.provincia = provincia;
    }

    if (contrasena) {
      usuario.contrasena = contrasena;
    }

    await usuario.save();
    res.redirect("/perfil");
  } catch (err) {
    console.error("Error al actualizar perfil:", err);
    res.send("Error al actualizar perfil");
  }
});

// Ruta para top5
app.get("/top5", async (req, res) => {
  if (!req.session.usuario) {
    return res.redirect("/login");
  }

  try {
    const miTest = await Test.findOne({ usuario: req.session.usuario._id });

    if (!miTest) {
      return res.send("Aún no has realizado el test.");
    }

    const otrosTests = await Test.find({ usuario: { $ne: req.session.usuario._id } }).populate("usuario");

    const compatibilidades = [];

    otrosTests.forEach((test) => {
      const respuestasOtro = test.respuestas;
      const respuestasMias = miTest.respuestas;

      let coincidencias = 0;
      respuestasMias.forEach((respuesta, index) => {
        if (respuesta === respuestasOtro[index]) {
          coincidencias++;
        }
      });

      const porcentaje = Math.round((coincidencias / respuestasMias.length) * 100);

      compatibilidades.push({
        usuario: test.usuario,
        porcentaje: porcentaje
      });
    });

    compatibilidades.sort((a, b) => b.porcentaje - a.porcentaje);
    const top5 = compatibilidades.slice(0, 5);

    for (const item of top5) {
      const likeDado = await Like.findOne({
        de: req.session.usuario._id,
        para: item.usuario._id
      });

      if (likeDado && likeDado.match) {
        item.estado = "match";
      } else if (likeDado) {
        item.estado = "like";
      } else {
        item.estado = "normal";
      }
    }

    res.render("top5", { usuario: req.session.usuario, top5 });
  } catch (error) {
    console.error("Error al cargar top 5:", error);
    res.send("Error al cargar top 5.");
  }
});

// Ruta para likes
app.post("/like", async (req, res) => {
  if (!req.session.usuario) return res.status(401).send("No autorizado");

  const { targetUserId } = req.body;

  try {
    let existingLike = await Like.findOne({
      de: req.session.usuario._id,
      para: targetUserId
    });

    if (!existingLike) {
      existingLike = new Like({
        de: req.session.usuario._id,
        para: targetUserId
      });
      await existingLike.save();
    }

    const reciprocalLike = await Like.findOne({
      de: targetUserId,
      para: req.session.usuario._id
    });

    if (reciprocalLike) {
      existingLike.match = true;
      reciprocalLike.match = true;
      await existingLike.save();
      await reciprocalLike.save();
    }

    res.send("Like registrado");
  } catch (err) {
    console.error("Error al registrar like:", err);
    res.status(500).send("Error al registrar like");
  }
});

// Ruta para verificar autenticación
app.get("/check-auth", async (req, res) => {
  console.log("Sesión en /check-auth:", req.session);
  console.log("Cookie en /check-auth:", req.headers.cookie);
  console.log("SessionID en /check-auth:", req.sessionID);
  if (req.session.usuario) {
    console.log("Usuario autenticado:", req.session.usuario);
    res.json({
      isAuthenticated: true,
      userName: req.session.usuario.nombre,
    });
  } else {
    console.log("No hay usuario en sesión, verificando MongoDB con SID:", req.sessionID);
    try {
      // Depurar cookies recibidas
      const cookieHeader = req.headers.cookie;
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split('=');
          acc[name] = value;
          return acc;
        }, {});
        console.log("Cookies parseadas en /check-auth:", cookies);
      } else {
        console.log("No se recibieron cookies en /check-auth");
      }
      const session = await new Promise((resolve, reject) => {
        mongoStore.get(req.sessionID, (err, session) => {
          if (err) {
            console.error("Error al recuperar sesión de MongoDB:", err.message);
            reject(err);
          } else {
            resolve(session);
          }
        });
      });
      console.log("Sesión recuperada de MongoDB en /check-auth:", session);
      res.json({ isAuthenticated: false });
    } catch (err) {
      console.error("Error al recuperar sesión en /check-auth:", err.message);
      res.json({ isAuthenticated: false });
    }
  }
});


// Endpoint para depurar sesiones
app.get("/debug-session", async (req, res) => {
  try {
    const sessionId = req.sessionID;
    console.log("Debug: SessionID solicitado:", sessionId);
    const session = await new Promise((resolve, reject) => {
      mongoStore.get(sessionId, (err, session) => {
        if (err) {
          console.error("Debug: Error al recuperar sesión:", err);
          reject(err);
        } else {
          resolve(session);
        }
      });
    });
    res.json({
      sessionId: sessionId,
      sessionData: session,
      cookies: req.headers.cookie || "No cookies received"
    });
  } catch (err) {
    console.error("Debug: Error en /debug-session:", err.message);
    res.status(500).json({ message: "Error al depurar sesión" });
  }
});

// Levantar servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});