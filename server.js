import express from 'express'; // Importar Express
import session from 'express-session'; // Importar session
import mongoose from 'mongoose'; // Importar mongoose para MongoDB
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv'; // Para añadir el .env
import path from 'path'; // Para trabajar con rutas de archivos
import { fileURLToPath } from 'url'; // Para obtener el nombre del archivo actual
import cors from 'cors';



//IMPORTAR LOS MODELS JS
import Pregunta from './models/Preguntas.js';
import User from './models/User.js';
import Test from './models/Test.js';
import Like from './models/Like.js';


dotenv.config(); // Cargar las variables de entorno del archivo .env
console.log("NODE_ENV:", process.env.NODE_ENV);

// Configurar las rutas de los archivos
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear la app de Express
const app = express();

// Configuración de Express
app.set("views", path.join(__dirname, "views")); // Configuración de las vistas (EJS)
app.set("view engine", "ejs"); // Usamos EJS para las vistas

app.use(express.urlencoded({ extended: true })); // Para poder recibir datos del formulario
app.use(express.json());


// Configuración de la sesión
app.use(session({
  secret: '123abc',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    clientPromise: mongoose.connection.asPromise().then((connection) => connection.getClient()),
    ttl: 24 * 60 * 60, // 1 día
    autoRemove: 'native'
  }),
  cookie: {
    secure: false, // Temporalmente para depuración
    sameSite: 'none', // Necesario para cross-origin
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 día
    path: '/'
  }
}));

// Middleware para depurar cookies y sesiones
app.use((req, res, next) => {
  console.log(`[${req.method} ${req.path}] Cookie recibida:`, req.headers.cookie);
  console.log(`[${req.method} ${req.path}] Sesión:`, req.session);
  console.log(`[${req.method} ${req.path}] SessionID:`, req.sessionID);
  // Depurar headers de respuesta
  const originalSend = res.send;
  res.send = function (body) {
    console.log(`[${req.method} ${req.path}] Response headers:`, res.getHeaders());
    return originalSend.call(this, body);
  };
  next();
});

// Configuración de CORS (debe ir antes de las rutas)
app.use(cors({
  origin: "http://localhost:5173",           // Permite cualquier origen
  credentials: true      // Permite el uso de cookies
}));


app.use(express.static(path.join(__dirname, '../public')));

// Conectar a MongoDB
mongoose.connect(process.env.MONGO_URI, {
})
    .then(() => console.log('Conectado a MongoDB'))
    .catch((err) => console.log('Error al conectar a MongoDB:', err));

    
//-------------------------------------------------------------
//-------------------------RUTAS-------------------------------

//------------RUTA PRINCIPAL------------------
app.get("/", (req, res) => {
    if (!req.session.usuario) {
        return res.redirect("/login"); // Si no hay sesión, redirigir a login
    }
    res.render("index", { usuario: req.session.usuario });  // Si hay sesión, renderizamos la página principal
});
  
//--------------------------------------------
//------------RUTA DE LOGIN (GET)-------------
app.get("/login", (req, res) => {
    if (req.session.usuario) {
        return res.redirect("/"); // Si ya está logueado, redirigir a la home
    }
    res.render("login"); // Renderizamos la vista de login
});

//--------------------------------------------
//----------RUTA DE REGISTRO (GET)------------ 
app.get("/register", (req, res) => {
    res.render("register"); // Renderizamos la vista de registro
});

// Ruta POST de registro
app.post("/register", async (req, res) => {
  const { nombre, edad, genero, provincia, contrasena } = req.body;

  try {
    // Comprobar si ya existe un usuario con ese nombre
    const existingUser = await User.findOne({ nombre });
    if (existingUser) {
      console.log("Este nombre de usuario ya está en uso.");
      return res.redirect("/register"); 
    }

    // Crear el nuevo usuario
    const newUser = new User({
      nombre,
      edad,
      genero,
      provincia,
      contrasena
    });
  
      // Guardar al usuario en la base de datos
      await newUser.save();
  
      // Redirigir al login después de crear la cuenta
      res.redirect("/login");
    } catch (err) {
      console.log(err);
      res.redirect("/register");  // En caso de error
    }
});

//--------------------------------------------
//------------RUTA DE LOGIN (POST)------------
app.post("/login", async (req, res) => {
  const { nombre, contrasena } = req.body;

  try {
    const user = await User.findOne({ nombre });

    if (!user || user.contrasena !== contrasena) {
      return res.status(401).json({ success: false, message: "Usuario o contraseña incorrectos" });
    }

    req.session.usuario = {
      _id: user._id,
      nombre: user.nombre
    };

    console.log("Sesión establecida en /login:", req.session);
    console.log("SessionID en /login:", req.sessionID);
    // Guardar sesión manualmente
    try {
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("Error al guardar sesión en /login:", err);
            reject(err);
          } else {
            console.log("Sesión guardada en /login, SID:", req.sessionID);
            resolve();
          }
        });
      });
      // Forzar envío de Set-Cookie
      res.set('Set-Cookie', `connect.sid=${req.sessionID}; Path=/; HttpOnly; SameSite=None`);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error al guardar sesión en /login:", err);
      return res.status(500).json({ success: false, message: "Error al guardar sesión" });
    }
  } catch (err) {
    console.error("Error en /login:", err);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

//--------------------------------------------
//--------------RUTA DE LOGOUT----------------
app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

//--------------------------------------------
//-------------RUTA PARA EL TEST--------------
app.get("/test", async (req, res) => {
  // Suponiendo que la sesión tiene al usuario logueado
  const user = await User.findById(req.session.usuario._id);

  if (user && user.haHechoTest) {
    return res.redirect("/testCompletado");
  }  

  try {
    // Obtener todas las preguntas de la base de datos
    const preguntas = await Pregunta.find();

    // Si no ha hecho el test, renderizamos el formulario con las preguntas
    res.render("test", { preguntas });
  } catch (err) {
    console.error("Error al obtener las preguntas:", err);
    res.send("Hubo un error al cargar las preguntas.");
  }
});

//---------RUTA PROCESAR RESPUESTAS TEST--------- 
app.post('/test', async (req, res) => {
  try {
    const respuestas = req.body.respuestas; // Recibimos las respuestas enviadas

    // Obtener el usuario logueado
    const usuario = await User.findById(req.session.usuario._id);

    // Crear un nuevo objeto Test para guardar las respuestas
    const nuevoTest = new Test({
      usuario: usuario._id,
      respuestas: respuestas,
    });

    await nuevoTest.save();

    // Marcar como que hizo el test
    await User.updateOne(
      { _id: usuario._id },
      { $set: { haHechoTest: true } }
    );

    res.redirect("/testCompletado");

  } catch (error) {
    console.error("Error al guardar el test", error);
    res.send("Hubo un error al procesar el test");
  }
});

//---------RUTA PARA TEST COMPLETADO---------
app.get("/testCompletado", (req, res) => {
  if (!req.session.usuario) {
    return res.redirect("/login");
  }

  // Pasamos directamente lo que hay en sesión a la vista
  res.render("testCompletado", { usuario: req.session.usuario });
});



//--------------------------------------------
//-----------RUTA PARA PERFIL(GET)------------
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

//-----------RUTA PARA PERFIL(POST)------------
app.post("/perfil", async (req, res) => {
  if (!req.session.usuario) {
    return res.redirect("/login"); // Si no hay sesión, redirigir a login
  }

  const { provincia, contrasena } = req.body;

  try {
    // Buscar al usuario en la base de datos usando el nombre desde la sesión
    const usuario = await User.findById(req.session.usuario._id);

    if (!usuario) {
      // Si el usuario no se encuentra, redirigirlo al login
      return res.redirect("/login");
    }

    // Actualizamos los campos permitidos
    if (provincia) {
      usuario.provincia = provincia;
    }

    if (contrasena) {
      usuario.contrasena = contrasena;
    }

    // Guardamos los cambios
    await usuario.save();

    // Redirigir a la página de perfil después de la actualización
    res.redirect("/perfil");
  } catch (err) {
    console.error("Error al actualizar perfil:", err);
    res.send("Error al actualizar perfil");
  }
});


//--------------------------------------------
//--------------RUTA PARA TOP5----------------
app.get("/top5", async (req, res) => {
  if (!req.session.usuario) {
    return res.redirect("/login");
  }

  try {
    // Obtener el test del usuario logeado
    const miTest = await Test.findOne({ usuario: req.session.usuario._id });

    if (!miTest) {
      return res.send("Aún no has realizado el test.");
    }

    // Obtener todos los tests excepto el mío
    const otrosTests = await Test.find({ usuario: { $ne: req.session.usuario._id } }).populate("usuario");

    // Array para guardar compatibilidades
    const compatibilidades = [];

    otrosTests.forEach((test) => {
      const respuestasOtro = test.respuestas;
      const respuestasMias = miTest.respuestas;

      // Calcular porcentaje de coincidencia
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

    // Ordenar de mayor a menor
    compatibilidades.sort((a, b) => b.porcentaje - a.porcentaje);

    // Seleccionar top 5
    const top5 = compatibilidades.slice(0, 5);

    //bucle de likes
    for (const item of top5) {
      // Ver si el usuario logueado ya le dio like a este usuario
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
            

    // Renderizar la vista pasando el top 5
    res.render("top5", { usuario: req.session.usuario, top5 });
  } catch (error) {
    console.error("Error al cargar top 5:", error);
    res.send("Error al cargar top 5.");
  }
});


//--------------------------------------------
//-------------RUTA PARA LIKES----------------

app.post("/like", async (req, res) => {
  if (!req.session.usuario) return res.status(401).send("No autorizado");

  const { targetUserId } = req.body;

  try {
    // Ver si ya existe un like previo de este usuario a target
    let existingLike = await Like.findOne({
      de: req.session.usuario._id,
      para: targetUserId
    });

    if (!existingLike) {
      // Crear nuevo like
      existingLike = new Like({
        de: req.session.usuario._id,
        para: targetUserId
      });
      await existingLike.save();
    }

    // Verificar si la otra persona también dio like
    const reciprocalLike = await Like.findOne({
      de: targetUserId,
      para: req.session.usuario._id
    });

    if (reciprocalLike) {
      // Si ambos dieron like, actualizar ambos a match
      existingLike.match = true;
      reciprocalLike.match = true;
      await existingLike.save();
      await reciprocalLike.save();
    }

    res.send("Like registrado");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al registrar like");
  }
});



// Ruta para verificar si el usuario está autenticado
app.get("/check-auth", async (req, res) => {
  console.log("Sesión en /check-auth:", req.session);
  console.log("Cookie en /check-auth:", req.headers.cookie);
  console.log("SessionID en /check-auth:", req.sessionID);
  if (req.session.usuario) {
    res.json({
      isAuthenticated: true,
      userName: req.session.usuario.nombre,
    });
  } else {
    const sessionId = req.sessionID;
    try {
      const session = await MongoStore.create({ mongoUrl: process.env.MONGO_URI }).get(sessionId);
      console.log("Sesión recuperada de MongoDB en /check-auth:", session);
      res.json({ isAuthenticated: false });
    } catch (err) {
      console.error("Error al recuperar sesión en /check-auth:", err);
      res.json({ isAuthenticated: false });
    }
  }
});





//------------------------------------------------------------------  
//------------------------------------------------------------------  
// Levantar servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});

