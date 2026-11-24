// 1. Configuración de Firebase (SDK Compat)
const firebaseConfig = {
  apiKey: "AIzaSyA8GnmmlGoSeaC5JaOAjcZDS0ZQBpUYUIM",
  authDomain: "app-vea-2.firebaseapp.com",
  projectId: "app-vea-2",
  storageBucket: "app-vea-2.firebasestorage.app",
  messagingSenderId: "43679100188",
  appId: "1:43679100188:web:bb006e0a238f5b37035ed9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
function obtenerFechaHoyArg() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}
function sumarDiasFechaISO(fechaBaseISO, dias) {
  const baseStr = String(fechaBaseISO || "").slice(0, 10);
  const [y, m, d] = baseStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(dias || 0));
  return dt.toISOString().slice(0, 10);
}

/**
 * Calcula el nuevo vencimiento (30 días) al registrar un pago:
 * - Si aún no venció (diasRestantes >= 0), suma 30 días desde `vencimientoActual` (fecha aniversario).
 * - Si ya venció / se cortó (diasRestantes < 0), suma 30 días desde `fechaPago` (reactiva desde hoy).
 */
function calcularProximoVencimientoAlPagar({ vencimientoActual, fechaPago }) {
  const hoyStr = fechaPago
    ? String(fechaPago).slice(0, 10)
    : (typeof obtenerFechaHoyArg === "function" ? obtenerFechaHoyArg() : new Date().toISOString().slice(0, 10));

  if (!vencimientoActual) {
    return sumarDiasFechaISO(hoyStr, 30);
  }

  const vencStr = String(vencimientoActual).slice(0, 10);
  const [y1, m1, d1] = hoyStr.split("-").map(Number);
  const [y2, m2, d2] = vencStr.split("-").map(Number);

  const utcHoy = Date.UTC(y1, m1 - 1, d1);
  const utcVenc = Date.UTC(y2, m2 - 1, d2);
  const diasRestantes = Math.round((utcVenc - utcHoy) / (1000 * 60 * 60 * 24));

  // Vigente o por vencer (aún no se cortó): respeta la fecha aniversario / vencimiento actual
  if (diasRestantes >= 0) {
    return sumarDiasFechaISO(vencStr, 30);
  }

  // Ya venció / se cortó (ej. pagó 15 días tarde): cuenta 30 días desde la fecha de pago
  return sumarDiasFechaISO(hoyStr, 30);
}
async function registrarYLeerVistasVidriera(comercio) {
  const idComercio = typeof comercio === "string"
    ? comercio
    : (comercio && (comercio.id || comercio.uid || comercio.comercioId) || "");
  if (!idComercio || typeof db === "undefined") {
    return { vistasHoy: 0, vistasTotales: 0 };
  }

  const hoyArg = typeof obtenerFechaHoyArg === "function" ? obtenerFechaHoyArg() : "";
  const docRef = db.collection("comercios").doc(idComercio);

  const uidActual = (typeof auth !== "undefined" && auth.currentUser && auth.currentUser.uid)
    ? auth.currentUser.uid
    : null;

  const duenoIds = (typeof comercio === "object" && comercio)
    ? [comercio.ownerId, comercio.uidComercio, comercio.duenoId, comercio.userId, comercio.creadoPor].filter(Boolean)
    : [];

  const esDueno = Boolean(uidActual && duenoIds.includes(uidActual));

  // Si es el dueño o no está logueado, solo leemos el estado real sin sumar
  if (!uidActual || esDueno) {
    const snap = await docRef.get();
    const data = snap.exists ? (snap.data() || {}) : {};
    return {
      vistasHoy: data.fechaUltimaVista === hoyArg ? Number(data.vistasHoy || 0) : 0,
      vistasTotales: Number(data.vistasTotales || 0)
    };
  }


  const visitaRef = docRef.collection("vistasUnicas").doc(uidActual);

  return db.runTransaction(async (tx) => {
    const [comSnap, visSnap] = await Promise.all([tx.get(docRef), tx.get(visitaRef)]);
    const comData = comSnap.exists ? (comSnap.data() || {}) : {};
    const visData = visSnap.exists ? (visSnap.data() || {}) : {};

    const vistasHoyActual = comData.fechaUltimaVista === hoyArg ? Number(comData.vistasHoy || 0) : 0;
    const vistasTotalesActual = Number(comData.vistasTotales || 0);

    // Ya contó hoy para este usuario: no inflar
    if (visSnap.exists && visData.fecha === hoyArg) {
      return {
        vistasHoy: vistasHoyActual,
        vistasTotales: vistasTotalesActual
      };
    }

    const nuevasVistasHoy = vistasHoyActual + 1;
    const nuevasVistasTotales = vistasTotalesActual + 1;

    tx.set(visitaRef, {
      uid: uidActual,
      fecha: hoyArg,
      ultimaVista: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    tx.set(docRef, {
      vistasHoy: nuevasVistasHoy,
      vistasTotales: nuevasVistasTotales,
      fechaUltimaVista: hoyArg
    }, { merge: true });

    return {
      vistasHoy: nuevasVistasHoy,
      vistasTotales: nuevasVistasTotales
    };
  });
}
// 2. Referencias al DOM
const estadoEl = document.getElementById("estado-app");
const detalleEl = document.getElementById("detalle-conexion");
const inputPrueba = document.getElementById("texto-prueba");
const btnGuardar = document.getElementById("btn-guardar");
const listaPrueba = document.getElementById("lista-prueba");

// 3. Verificación de conexión
db.collection("ping").limit(1).get()
  .then(() => {
    estadoEl.textContent = "VEA App - Conectado";
    detalleEl.textContent = "Proyecto: " + firebaseConfig.projectId + " (Firestore OK)";
  })
  .catch((error) => {
    estadoEl.textContent = "VEA App - Error de conexión";
    detalleEl.textContent = error.message;
  });

// 4. Guardar ítems en Firestore
btnGuardar.addEventListener("click", () => {
  const texto = inputPrueba.value.trim();
  if (!texto) return;

  db.collection("pruebas").add({
    texto: texto,
    creadoEn: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    inputPrueba.value = "";
  }).catch((err) => {
    console.error("Error al guardar:", err);
  });
});

// 5. Leer ítems en tiempo real
db.collection("pruebas").orderBy("creadoEn", "desc").limit(10)
  .onSnapshot((snapshot) => {
    listaPrueba.innerHTML = "";
    snapshot.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = doc.data().texto;
      listaPrueba.appendChild(li);
    });
  }, (err) => {
    console.error("Error leyendo Firestore:", err);
  });

// 6. Registro e inicio de sesión en Firebase Auth + Firestore
const formRegistro = document.getElementById("form-registro");
const regNombre = document.getElementById("reg-nombre");
const regDireccion = document.getElementById("reg-direccion");
const regTelefono = document.getElementById("reg-telefono");
const regEmail = document.getElementById("reg-email");
const regPassword = document.getElementById("reg-password");
const regPassword2 = document.getElementById("reg-password2");
const mensajeRegistro = document.getElementById("mensaje-registro");
const seccionRegistro = document.getElementById("seccion-registro");

const seccionLogin = document.getElementById("seccion-login");
const formLogin = document.getElementById("form-login");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const mensajeLogin = document.getElementById("mensaje-login");
const btnIrRegistro = document.getElementById("btn-ir-registro");
const btnIrLogin = document.getElementById("btn-ir-login");

function alternarAuth(mostrarLogin) {
  if (typeof usuarioActual !== "undefined" && usuarioActual) return;
  if (seccionLogin) seccionLogin.classList.toggle("hidden", !mostrarLogin);
  if (seccionRegistro) seccionRegistro.classList.toggle("hidden", mostrarLogin);
  if (mensajeLogin) mensajeLogin.textContent = "";
  if (mensajeRegistro) mensajeRegistro.textContent = "";
}

if (btnIrRegistro) {
  btnIrRegistro.addEventListener("click", () => alternarAuth(false));
}

if (btnIrLogin) {
  btnIrLogin.addEventListener("click", () => alternarAuth(true));
}

if (formRegistro) {
  formRegistro.addEventListener("submit", (e) => {
    e.preventDefault();

    const nombreApellido = (regNombre ? regNombre.value : "").trim();
    const direccion = (regDireccion ? regDireccion.value : "").trim();
    const telefono = (regTelefono ? regTelefono.value : "").trim();
    const email = (regEmail ? regEmail.value : "").trim();
    const password = regPassword ? regPassword.value : "";
    const password2 = regPassword2 ? regPassword2.value : "";

    if (!nombreApellido || !direccion || !telefono || !email || !password || !password2) {
      if (mensajeRegistro) mensajeRegistro.textContent = "Completá todos los campos.";
      return;
    }

    if (password.length < 6) {
      if (mensajeRegistro) mensajeRegistro.textContent = "La contraseña debe tener al menos 6 caracteres.";
      return;
    }

    if (password !== password2) {
      if (mensajeRegistro) mensajeRegistro.textContent = "Las contraseñas no coinciden.";
      return;
    }

    if (mensajeRegistro) mensajeRegistro.textContent = "Creando cuenta...";

    auth.createUserWithEmailAndPassword(email, password)
      .then((cred) => {
        const uid = cred.user.uid;
        return db.collection("usuarios").doc(uid).set({
          nombreApellido: nombreApellido,
          direccion: direccion,
          telefono: telefono,
          email: email,
          plan: "basico",
          creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
      })
      .then(() => {
        if (mensajeRegistro) mensajeRegistro.textContent = "Cuenta creada correctamente.";
        formRegistro.reset();
      })
      .catch((err) => {
        console.error("Error en registro:", err);
        if (mensajeRegistro) mensajeRegistro.textContent = "Error: " + err.message;
      });
  });
}

if (formLogin) {
  formLogin.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = (loginEmail ? loginEmail.value : "").trim();
    const password = loginPassword ? loginPassword.value : "";

    if (!email || !password) {
      if (mensajeLogin) mensajeLogin.textContent = "Completá correo y contraseña.";
      return;
    }

    if (mensajeLogin) mensajeLogin.textContent = "Iniciando sesión y recuperando datos...";

    auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        if (mensajeLogin) mensajeLogin.textContent = "Sesión iniciada.";
        formLogin.reset();
      })
      .catch((err) => {
        console.error("Error en login:", err);
        if (mensajeLogin) mensajeLogin.textContent = "Error al iniciar sesión: " + err.message;
      });
  });
}

// 7. Menú desplegable, Perfil editable y Vidriera Comercial
const btnTriggerMenu = document.getElementById("btn-trigger-menu");
const dropdownUsuario = document.getElementById("dropdown-usuario");
const avatarUsuario = document.getElementById("avatar-usuario");
const textoUsuarioHeader = document.getElementById("texto-usuario-header");
const menuNombreUsuario = document.getElementById("menu-nombre-usuario");
const menuEmailUsuario = document.getElementById("menu-email-usuario");
const btnCerrarSesion = document.getElementById("btn-cerrar-sesion");
const datosPerfilNube = document.getElementById("datos-perfil-nube");

const formPerfil = document.getElementById("form-perfil");
const perfilFotoInput = document.getElementById("perfil-foto-input");
const previewFotoPerfil = document.getElementById("preview-foto-perfil");
const btnQuitarFoto = document.getElementById("btn-quitar-foto");
const perfilNombre = document.getElementById("perfil-nombre");
const perfilDireccion = document.getElementById("perfil-direccion");
const perfilTelefono = document.getElementById("perfil-telefono");
const btnCerrarPerfil = document.getElementById("btn-cerrar-perfil");
const mensajePerfil = document.getElementById("mensaje-perfil");

const badgePlanVidriera = document.getElementById("badge-plan-vidriera");
const estadoPlanDetalle = document.getElementById("estado-plan-detalle");
const formVidriera = document.getElementById("form-vidriera");
const vidNombreComercio = document.getElementById("vid-nombre-comercio");
const vidDireccion = document.getElementById("vid-direccion");
const vidTelefono = document.getElementById("vid-telefono");
const vidSugerenciasDireccion = document.getElementById("vid-sugerencias-direccion");
const vidCoordsTexto = document.getElementById("vid-coords-texto");
const vidFachadaInput = document.getElementById("vid-fachada-input");
const vidPreviewFachada = document.getElementById("vid-preview-fachada");
const btnQuitarFachada = document.getElementById("btn-quitar-fachada");
const labelVideoVidriera = document.getElementById("label-video-vidriera");
const vidVideoInput = document.getElementById("vid-video-input");
const vidVideoEstado = document.getElementById("vid-video-estado");
const vidPreviewVideo = document.getElementById("vid-preview-video");
const btnQuitarVideo = document.getElementById("btn-quitar-video");
const vidCuponTitulo = document.getElementById("vid-cupon-titulo");
const vidCuponCodigo = document.getElementById("vid-cupon-codigo");
const btnAgregarCupon = document.getElementById("btn-agregar-cupon");
const vidListaCupones = document.getElementById("vid-lista-cupones");
const labelPublicacionesVidriera = document.getElementById("label-publicaciones-vidriera");
const vidPubFoto = document.getElementById("vid-pub-foto");
const vidPubTitulo = document.getElementById("vid-pub-titulo");
const vidPubDescripcion = document.getElementById("vid-pub-descripcion");
const btnAgregarPublicacion = document.getElementById("btn-agregar-publicacion");
const vidListaPublicaciones = document.getElementById("vid-lista-publicaciones");
const btnCerrarVidriera = document.getElementById("btn-cerrar-vidriera");
const mensajeVidriera = document.getElementById("mensaje-vidriera");
const vidrieraReflejoContenido = document.getElementById("vidriera-reflejo-contenido");

const PLANES_VEA = {
  basico: { nombre: "BÁSICO", maxPubs: 10, maxVideoSec: 10 },
  estandar: { nombre: "ESTÁNDAR", maxPubs: 20, maxVideoSec: 20 },
  premium: { nombre: "PREMIUM", maxPubs: 40, maxVideoSec: 60 }
};

let fotoPerfilActual = "";
let telefonoUsuarioActual = "";
let usuarioActual = null;
let planActualUsuario = "basico";
let fotoFachadaActual = "";
let videoVerticalActual = "";
let cuponesVidriera = [];
let publicacionesVidriera = [];
let latVidriera = -34.6434;
let lngVidriera = -58.6231;
let mapaVidriera = null;
let pinVidriera = null;
let timerSugerencias = null;

const vistasMenu = {
  perfil: document.getElementById("vista-perfil"),
  vidriera: document.getElementById("vista-vidriera")
};

function mostrarVista(nombreVista) {
  Object.values(vistasMenu).forEach((sec) => {
    if (sec) sec.classList.add("hidden");
  });
  if (vistasMenu[nombreVista]) {
    vistasMenu[nombreVista].classList.remove("hidden");
  }
  if (nombreVista === "vidriera") {
    inicializarMapaVidriera();
  }
  if (dropdownUsuario) {
    dropdownUsuario.classList.add("hidden");
  }
  if (btnTriggerMenu) {
    btnTriggerMenu.setAttribute("aria-expanded", "false");
  }
}

function escaparHTML(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function formatearWhatsAppUrl(telefono) {
  let digits = String(telefono ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("549")) {
    if (digits.startsWith("54") && !digits.startsWith("549")) {
      digits = "549" + digits.slice(2);
    } else if (digits.length >= 10 && digits.length <= 11) {
      digits = "549" + digits;
    }
  }
  return `https://wa.me/${digits}`;
}

function renderizarAvatarHeader(fotoBase64, fallbackTexto) {
  if (!avatarUsuario) return;
  if (fotoBase64) {
    avatarUsuario.innerHTML = `<img src="${fotoBase64}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
  } else {
    avatarUsuario.textContent = fallbackTexto;
  }
}

function renderizarPreviewFoto(fotoBase64) {
  if (!previewFotoPerfil) return;
  if (fotoBase64) {
    previewFotoPerfil.src = fotoBase64;
    previewFotoPerfil.classList.remove("hidden");
  } else {
    previewFotoPerfil.removeAttribute("src");
    previewFotoPerfil.classList.add("hidden");
  }
}

function comprimirImagen(file, maxSize = 240, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo seleccionado no es una imagen válida."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

if (perfilFotoInput) {
  perfilFotoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    comprimirImagen(file, 240, 0.78)
      .then((dataUrl) => {
        fotoPerfilActual = dataUrl;
        renderizarPreviewFoto(fotoPerfilActual);
        if (mensajePerfil) mensajePerfil.textContent = "Foto cargada. Tocá 'Guardar cambios' para guardar en la nube.";
      })
      .catch((err) => {
        if (mensajePerfil) mensajePerfil.textContent = "Error: " + err.message;
      });
  });
}

if (btnQuitarFoto) {
  btnQuitarFoto.addEventListener("click", () => {
    fotoPerfilActual = "";
    if (perfilFotoInput) perfilFotoInput.value = "";
    renderizarPreviewFoto("");
    if (mensajePerfil) mensajePerfil.textContent = "Foto quitada. Tocá 'Guardar cambios' para confirmar.";
  });
}

if (formPerfil) {
  formPerfil.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!usuarioActual) return;

    const nombreApellido = (perfilNombre ? perfilNombre.value : "").trim();
    const direccion = (perfilDireccion ? perfilDireccion.value : "").trim();
    const telefono = (perfilTelefono ? perfilTelefono.value : "").trim();

    if (!nombreApellido || !direccion || !telefono) {
      if (mensajePerfil) mensajePerfil.textContent = "Completá nombre, dirección y teléfono.";
      return;
    }

    if (mensajePerfil) mensajePerfil.textContent = "Guardando cambios...";

    db.collection("usuarios").doc(usuarioActual.uid).set({
      nombreApellido: nombreApellido,
      direccion: direccion,
      telefono: telefono,
      fotoPerfil: fotoPerfilActual,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
      .then(() => {
        telefonoUsuarioActual = telefono;
        if (vidTelefono && !vidTelefono.value.trim()) {
          vidTelefono.value = telefono;
        }
        const inicial = (usuarioActual.email || "U").charAt(0).toUpperCase();
        renderizarAvatarHeader(fotoPerfilActual, inicial);
        if (menuNombreUsuario) menuNombreUsuario.textContent = nombreApellido;
        if (textoUsuarioHeader) textoUsuarioHeader.textContent = nombreApellido;
        if (datosPerfilNube) {
          datosPerfilNube.textContent =
            "Nombre: " + nombreApellido +
            " | Dirección: " + direccion +
            " | Teléfono: " + telefono +
            " | Email: " + usuarioActual.email;
        }
        if (mensajePerfil) mensajePerfil.textContent = "Perfil actualizado en la nube.";
      })
      .catch((err) => {
        if (mensajePerfil) mensajePerfil.textContent = "Error al guardar: " + err.message;
      });
  });
}

if (btnCerrarPerfil) {
  btnCerrarPerfil.addEventListener("click", () => mostrarVista(null));
}

function obtenerConfigPlan() {
  return PLANES_VEA[planActualUsuario] || PLANES_VEA.basico;
}

function actualizarUIPlanVidriera() {
  const cfg = obtenerConfigPlan();
  if (badgePlanVidriera) badgePlanVidriera.textContent = "Plan activo: " + cfg.nombre;
  if (estadoPlanDetalle) {
    estadoPlanDetalle.textContent = `Límites de tu plan: hasta ${cfg.maxPubs} publicaciones y video vertical de hasta ${cfg.maxVideoSec}s.`;
  }
  if (labelVideoVidriera) {
    labelVideoVidriera.textContent = `Video promocional vertical (máximo ${cfg.maxVideoSec}s según tu plan)`;
  }
  if (labelPublicacionesVidriera) {
    labelPublicacionesVidriera.textContent = `Publicaciones (${publicacionesVidriera.length} / ${cfg.maxPubs} máx.)`;
  }
}

function inicializarMapaVidriera() {
  const cont = document.getElementById("vidriera-mapa");
  if (!cont || typeof L === "undefined") return;

  if (!mapaVidriera) {
    mapaVidriera = L.map("vidriera-mapa").setView([latVidriera, lngVidriera], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(mapaVidriera);
    pinVidriera = L.marker([latVidriera, lngVidriera]).addTo(mapaVidriera);
  } else {
    mapaVidriera.setView([latVidriera, lngVidriera], 15);
    if (pinVidriera) pinVidriera.setLatLng([latVidriera, lngVidriera]);
  }
  setTimeout(() => mapaVidriera.invalidateSize(), 180);
}

function actualizarCoordenadasVidriera(lat, lng, etiqueta) {
  latVidriera = lat;
  lngVidriera = lng;
  if (vidCoordsTexto) {
    vidCoordsTexto.textContent = `Ubicación fijada: ${etiqueta || ""} (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  }
  inicializarMapaVidriera();
}

if (vidDireccion && vidSugerenciasDireccion) {
  vidDireccion.addEventListener("input", () => {
    const q = vidDireccion.value.trim();
    if (q.length < 4) {
      vidSugerenciasDireccion.classList.add("hidden");
      return;
    }

    clearTimeout(timerSugerencias);
    timerSugerencias = setTimeout(() => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ar&limit=6&q=${encodeURIComponent(q + ", Argentina")}`;
      fetch(url)
        .then((res) => res.json())
        .then((resultados) => {
          vidSugerenciasDireccion.innerHTML = "";
          if (!resultados || !resultados.length) {
            vidSugerenciasDireccion.classList.add("hidden");
            return;
          }
          resultados.forEach((lugar) => {
            const item = document.createElement("div");
            item.style.cssText = "padding:8px 10px; font-size:0.82rem; border-bottom:1px solid #eee; cursor:pointer;";
            item.textContent = lugar.display_name;
            item.addEventListener("click", () => {
              vidDireccion.value = lugar.display_name;
              vidSugerenciasDireccion.classList.add("hidden");
              actualizarCoordenadasVidriera(parseFloat(lugar.lat), parseFloat(lugar.lon), lugar.display_name);
            });
            vidSugerenciasDireccion.appendChild(item);
          });
          vidSugerenciasDireccion.classList.remove("hidden");
        })
        .catch((err) => {
          console.error("Error buscando direcciones:", err);
        });
    }, 350);
  });
}

function renderizarPreviewFachada(dataUrl) {
  if (!vidPreviewFachada) return;
  if (dataUrl) {
    vidPreviewFachada.src = dataUrl;
    vidPreviewFachada.classList.remove("hidden");
  } else {
    vidPreviewFachada.removeAttribute("src");
    vidPreviewFachada.classList.add("hidden");
  }
}

if (vidFachadaInput) {
  vidFachadaInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    comprimirImagen(file, 640, 0.75)
      .then((dataUrl) => {
        fotoFachadaActual = dataUrl;
        renderizarPreviewFachada(fotoFachadaActual);
        if (mensajeVidriera) mensajeVidriera.textContent = "Foto de fachada cargada. Tocá 'Guardar y actualizar vidriera'.";
      })
      .catch((err) => {
        if (mensajeVidriera) mensajeVidriera.textContent = "Error en fachada: " + err.message;
      });
  });
}

if (btnQuitarFachada) {
  btnQuitarFachada.addEventListener("click", () => {
    fotoFachadaActual = "";
    if (vidFachadaInput) vidFachadaInput.value = "";
    renderizarPreviewFachada("");
  });
}

function renderizarPreviewVideo(dataUrl) {
  if (!vidPreviewVideo) return;
  if (dataUrl) {
    vidPreviewVideo.src = dataUrl;
    vidPreviewVideo.classList.remove("hidden");
    if (btnQuitarVideo) btnQuitarVideo.classList.remove("hidden");
  } else {
    vidPreviewVideo.removeAttribute("src");
    vidPreviewVideo.classList.add("hidden");
    if (btnQuitarVideo) btnQuitarVideo.classList.add("hidden");
  }
}

if (vidVideoInput) {
  vidVideoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const cfg = obtenerConfigPlan();
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);
    tempVideo.src = objectUrl;

   tempVideo.onloadedmetadata = async () => {
  URL.revokeObjectURL(objectUrl);
  const duracion = tempVideo.duration;
  const ancho = tempVideo.videoWidth;
  const alto = tempVideo.videoHeight;

  if (ancho >= alto) {
    vidVideoInput.value = "";
    if (vidVideoEstado) {
      vidVideoEstado.textContent = `Rechazado: el video es horizontal (${ancho}x${alto}). Subí un video vertical.`;
    }
    return;
  }

  if (duracion > cfg.maxVideoSec) {
    vidVideoInput.value = "";
    if (vidVideoEstado) {
      vidVideoEstado.textContent = `Rechazado: dura ${Math.round(duracion)}s y tu plan ${cfg.nombre} permite hasta ${cfg.maxVideoSec}s.`;
    }
    return;
  }

  async function recomprimirVideoVertical(file, duracionSeg, anchoOrig, altoOrig) {
    if (!window.MediaRecorder || typeof document.createElement("canvas").captureStream !== "function") {
      return null;
    }

    const maxAncho = 480;
    const escala = anchoOrig > maxAncho ? maxAncho / anchoOrig : 1;
    const targetAncho = Math.max(240, Math.round(anchoOrig * escala));
    const targetAlto = Math.max(320, Math.round(altoOrig * escala));

    const canvas = document.createElement("canvas");
    canvas.width = targetAncho;
    canvas.height = targetAlto;
    const ctx = canvas.getContext("2d");

    const videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.src = URL.createObjectURL(file);

    await new Promise((resolve, reject) => {
      videoEl.onloadedmetadata = resolve;
      videoEl.onerror = reject;
    });

    const mimeCandidatos = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4"
    ];
    const mimeType = mimeCandidatos.find((t) => MediaRecorder.isTypeSupported(t)) || "";

    const stream = canvas.captureStream(24);
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 380000
    });

    const trozos = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) trozos.push(ev.data);
    };

    const finalizado = new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    recorder.start();
    await videoEl.play();

    await new Promise((resolve) => {
      const dibujarCuadro = () => {
        if (videoEl.ended || videoEl.paused) {
          resolve();
          return;
        }
        ctx.drawImage(videoEl, 0, 0, targetAncho, targetAlto);
        requestAnimationFrame(dibujarCuadro);
      };
      requestAnimationFrame(dibujarCuadro);
    });

    if (recorder.state !== "inactive") recorder.stop();
    await finalizado;
    URL.revokeObjectURL(videoEl.src);

    const blobFinal = new Blob(trozos, { type: mimeType || "video/webm" });
    return blobFinal.size > 0 ? blobFinal : null;
  }

  const limiteBytes = 700 * 1024;
  let archivoParaLeer = file;

  if (file.size > limiteBytes) {
    if (vidVideoEstado) {
      vidVideoEstado.textContent = "Ajustando video para que cargue más rápido...";
    }
    const recomprimido = await recomprimirVideoVertical(file, duracion, ancho, alto);
    if (recomprimido && recomprimido.size < file.size) {
      archivoParaLeer = recomprimido;
    }
  }

  if (archivoParaLeer.size > limiteBytes) {
    vidVideoInput.value = "";
    if (vidVideoEstado) {
      vidVideoEstado.textContent = "El video quedó muy pesado para guardarse ahora. Probá grabarlo más cortito o en baja calidad desde la cámara del celular.";
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    videoVerticalActual = reader.result;
    renderizarPreviewVideo(videoVerticalActual);
    if (vidVideoEstado) {
      vidVideoEstado.textContent = `Video vertical válido (${ancho}x${alto}, ${Math.round(duracion)}s). Guardá la vidriera para aplicarlo.`;
    }
  };
  reader.readAsDataURL(archivoParaLeer);
};
});
}

function renderizarCuponesVidriera() {
  if (!vidListaCupones) return;
  vidListaCupones.innerHTML = "";
  cuponesVidriera.forEach((cup, idx) => {
    const li = document.createElement("li");
    li.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:4px;";
    li.innerHTML = `<span>🎟️ <strong>${escaparHTML(cup.titulo)}</strong> — Código: <code>${escaparHTML(cup.codigo)}</code></span>`;
    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.textContent = "Eliminar";
    btnDel.addEventListener("click", () => {
      cuponesVidriera.splice(idx, 1);
      renderizarCuponesVidriera();
    });
    li.appendChild(btnDel);
    vidListaCupones.appendChild(li);
  });
}

if (btnAgregarCupon) {
  btnAgregarCupon.addEventListener("click", () => {
    const titulo = (vidCuponTitulo ? vidCuponTitulo.value : "").trim();
    const codigo = (vidCuponCodigo ? vidCuponCodigo.value : "").trim().toUpperCase();
    if (!titulo || !codigo) {
      if (mensajeVidriera) mensajeVidriera.textContent = "Completá título y código del cupón.";
      return;
    }
    cuponesVidriera.push({ titulo, codigo });
    if (vidCuponTitulo) vidCuponTitulo.value = "";
    if (vidCuponCodigo) vidCuponCodigo.value = "";
    renderizarCuponesVidriera();
  });
}

function renderizarPublicacionesVidriera() {
  actualizarUIPlanVidriera();
  if (!vidListaPublicaciones) return;
  vidListaPublicaciones.innerHTML = "";

  publicacionesVidriera.forEach((pub, idx) => {
    const card = document.createElement("div");
    card.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px; border:1px solid #cbd5e1; border-radius:8px; padding:8px; margin-bottom:6px;";
    const thumb = pub.foto
      ? `<img src="${pub.foto}" alt="" style="width:48px; height:48px; object-fit:cover; border-radius:6px;">`
      : "";
    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        ${thumb}
        <div>
          <strong>${escaparHTML(pub.titulo)}</strong>
          <p class="subtexto" style="margin:0;">${escaparHTML(pub.descripcion)}</p>
        </div>
      </div>
    `;
    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.textContent = "Eliminar";
    btnDel.addEventListener("click", () => {
      publicacionesVidriera.splice(idx, 1);
      renderizarPublicacionesVidriera();
    });
    card.appendChild(btnDel);
    vidListaPublicaciones.appendChild(card);
  });
}

if (btnAgregarPublicacion) {
  btnAgregarPublicacion.addEventListener("click", async () => {
    const cfg = obtenerConfigPlan();
    if (publicacionesVidriera.length >= cfg.maxPubs) {
      if (mensajeVidriera) {
        mensajeVidriera.textContent = `Alcanzaste el límite de ${cfg.maxPubs} publicaciones de tu plan ${cfg.nombre}.`;
      }
      return;
    }

    const titulo = (vidPubTitulo ? vidPubTitulo.value : "").trim();
    const descripcion = (vidPubDescripcion ? vidPubDescripcion.value : "").trim();
    const file = vidPubFoto && vidPubFoto.files ? vidPubFoto.files[0] : null;

    if (!titulo || !descripcion) {
      if (mensajeVidriera) mensajeVidriera.textContent = "Completá título y descripción de la publicación.";
      return;
    }

    let fotoData = "";
    if (file) {
      try {
        fotoData = await comprimirImagen(file, 480, 0.72);
      } catch (err) {
        if (mensajeVidriera) mensajeVidriera.textContent = "Error en foto de publicación: " + err.message;
        return;
      }
    }

    publicacionesVidriera.push({
      titulo: titulo,
      descripcion: descripcion,
      foto: fotoData
    });

    if (vidPubTitulo) vidPubTitulo.value = "";
    if (vidPubDescripcion) vidPubDescripcion.value = "";
    if (vidPubFoto) vidPubFoto.value = "";
    renderizarPublicacionesVidriera();
  });
}

function renderizarReflejoVidriera(datos) {
  if (!vidrieraReflejoContenido) return;
  if (!datos || !datos.nombreComercio) {
    vidrieraReflejoContenido.textContent = "Guardá tu vidriera para verla reflejada acá.";
    return;
  }

  const telefonoVisible = (datos.telefono || telefonoUsuarioActual || "").trim();
  const waUrl = formatearWhatsAppUrl(telefonoVisible);
  const badgeWhatsAppSvg = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="flex:0 0 auto;"><circle cx="12" cy="12" r="12" fill="#25D366"/><path fill="#ffffff" d="M17.47 14.38c-.28-.14-1.65-.81-1.91-.9-.26-.1-.44-.14-.63.14-.19.28-.72.9-.88 1.09-.16.19-.32.21-.6.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.39-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.63-1.52-.86-2.08-.23-.55-.46-.47-.63-.48h-.54c-.19 0-.49.07-.75.35-.26.28-.98.96-.98 2.34s1 2.71 1.14 2.9c.14.19 1.97 3.01 4.78 4.22.67.29 1.19.46 1.6.59.67.21 1.28.18 1.76.11.54-.08 1.65-.67 1.88-1.32.23-.65.23-1.21.16-1.32-.07-.12-.26-.19-.54-.33z"/></svg>`;

  const contactoWhatsAppHtml = telefonoVisible
    ? `<div style="display:inline-flex; align-items:center; gap:8px; flex-wrap:wrap; margin:6px 0 10px; padding:8px 12px; border-radius:10px; background:#f0fdf4; border:1px solid #86efac; color:#14532d; font-size:0.9rem;">
        ${badgeWhatsAppSvg}
        <span>Consultas al WhatsApp:</span>
        ${waUrl
          ? `<a href="${escaparHTML(waUrl)}" target="_blank" rel="noopener" style="font-weight:700; color:#15803d; text-decoration:underline;">${escaparHTML(telefonoVisible)}</a>`
          : `<strong>${escaparHTML(telefonoVisible)}</strong>`}
      </div>`
    : `<p class="subtexto">Consultas al WhatsApp: número no cargado.</p>`;

  const fachadaHtml = datos.fotoFachada
    ? `<img src="${datos.fotoFachada}" alt="Fachada" style="width:100%; max-height:180px; object-fit:cover; border-radius:8px; margin-bottom:8px;">`
    : "";

  const videoHtml = datos.videoVertical
    ? `<video controls playsinline src="${datos.videoVertical}" style="width:150px; max-height:260px; border-radius:8px; background:#000; display:block; margin:8px 0;"></video>`
    : "";

  const cuponesHtml = (datos.cupones || []).length
    ? `<ul>${datos.cupones.map((c) => `<li>🎟️ <strong>${escaparHTML(c.titulo)}</strong> — Código: <code>${escaparHTML(c.codigo)}</code></li>`).join("")}</ul>`
    : `<p class="subtexto">Sin cupones activos.</p>`;

  const pubsHtml = (datos.publicaciones || []).length
    ? `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:8px; margin-top:8px;">
        ${datos.publicaciones.map((p) => `
          <div style="border:1px solid #cbd5e1; border-radius:8px; padding:8px;">
            ${p.foto ? `<img src="${p.foto}" alt="" style="width:100%; height:110px; object-fit:cover; border-radius:6px; margin-bottom:4px;">` : ""}
            <strong>${escaparHTML(p.titulo)}</strong>
            <p class="subtexto" style="margin:2px 0 0;">${escaparHTML(p.descripcion)}</p>
          </div>
        `).join("")}
      </div>`
    : `<p class="subtexto">Sin publicaciones cargadas.</p>`;

  vidrieraReflejoContenido.innerHTML = `
    ${fachadaHtml}
    <h4>${escaparHTML(datos.nombreComercio)}</h4>
    <p class="subtexto">📍 ${escaparHTML(datos.direccion || "")}</p>
    ${contactoWhatsAppHtml}
    ${videoHtml}
    <strong>Cupones vigentes</strong>
    ${cuponesHtml}
    <strong>Publicaciones</strong>
    ${pubsHtml}
  `;
}

if (formVidriera) {
  formVidriera.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!usuarioActual) {
      if (mensajeVidriera) mensajeVidriera.textContent = "Tenés que iniciar sesión para guardar tu vidriera.";
      return;
    }

    const nombreComercio = (vidNombreComercio ? vidNombreComercio.value : "").trim();
    const direccion = (vidDireccion ? vidDireccion.value : "").trim();
    const telefonoComercio = ((vidTelefono ? vidTelefono.value : "").trim()) || telefonoUsuarioActual;

    if (!nombreComercio || !direccion) {
      if (mensajeVidriera) mensajeVidriera.textContent = "Completá el nombre del comercio y la dirección.";
      return;
    }

    if (mensajeVidriera) mensajeVidriera.textContent = "Guardando vidriera en la nube...";

    const payloadVidriera = {
      uid: usuarioActual.uid,
      email: usuarioActual.email,
      plan: planActualUsuario,
      nombreComercio: nombreComercio,
      direccion: direccion,
      telefono: telefonoComercio,
      whatsappUrl: formatearWhatsAppUrl(telefonoComercio),
      lat: latVidriera,
      lng: lngVidriera,
      fotoFachada: fotoFachadaActual,
      videoVertical: videoVerticalActual,
      cupones: cuponesVidriera,
      publicaciones: publicacionesVidriera,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("comercios").doc(usuarioActual.uid).set(payloadVidriera, { merge: true })
      .then(() => {
        if (vidTelefono && !vidTelefono.value.trim() && telefonoComercio) {
          vidTelefono.value = telefonoComercio;
        }
        renderizarReflejoVidriera(payloadVidriera);
        if (mensajeVidriera) mensajeVidriera.textContent = "Vidriera guardada y reflejada correctamente.";
      })
      .catch((err) => {
        console.error("Error guardando vidriera:", err);
        if (mensajeVidriera) mensajeVidriera.textContent = "Error al guardar vidriera: " + err.message;
      });
  });
}

if (btnCerrarVidriera) {
  btnCerrarVidriera.addEventListener("click", () => mostrarVista(null));
}

if (btnTriggerMenu && dropdownUsuario) {
  btnTriggerMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    const seraVisible = dropdownUsuario.classList.contains("hidden");
    dropdownUsuario.classList.toggle("hidden", !seraVisible);
    btnTriggerMenu.setAttribute("aria-expanded", String(seraVisible));
  });

  document.addEventListener("click", (e) => {
    if (!dropdownUsuario.contains(e.target) && !btnTriggerMenu.contains(e.target)) {
      dropdownUsuario.classList.add("hidden");
      btnTriggerMenu.setAttribute("aria-expanded", "false");
    }
  });
}

document.querySelectorAll(".dropdown-item[data-vista]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (mensajePerfil) mensajePerfil.textContent = "";
    if (mensajeVidriera) mensajeVidriera.textContent = "";
    mostrarVista(btn.dataset.vista);
  });
});

if (btnCerrarSesion) {
  btnCerrarSesion.addEventListener("click", () => {
    auth.signOut().then(() => {
      mostrarVista(null);
    });
  });
}

auth.onAuthStateChanged((user) => {
  usuarioActual = user || null;

  if (user) {
    if (seccionRegistro) seccionRegistro.classList.add("hidden");
    if (seccionLogin) seccionLogin.classList.add("hidden");

    const inicial = (user.email || "U").charAt(0).toUpperCase();
    renderizarAvatarHeader("", inicial);
    if (textoUsuarioHeader) textoUsuarioHeader.textContent = user.email;
    if (menuEmailUsuario) menuEmailUsuario.textContent = user.email;

    db.collection("usuarios").doc(user.uid).get()
      .then((doc) => {
        const datos = doc.exists ? doc.data() : {};
        const nombre = datos.nombreApellido || "Usuario";
        const direccion = datos.direccion || "";
        const telefono = datos.telefono || "";
        telefonoUsuarioActual = telefono;
        fotoPerfilActual = datos.fotoPerfil || "";
        planActualUsuario = (datos.plan && PLANES_VEA[datos.plan]) ? datos.plan : "basico";

        renderizarAvatarHeader(fotoPerfilActual, inicial);
        renderizarPreviewFoto(fotoPerfilActual);
        actualizarUIPlanVidriera();

        if (menuNombreUsuario) menuNombreUsuario.textContent = nombre;
        if (textoUsuarioHeader) textoUsuarioHeader.textContent = nombre;
        if (perfilNombre) perfilNombre.value = nombre === "Usuario" ? "" : nombre;
        if (perfilDireccion) perfilDireccion.value = direccion;
        if (perfilTelefono) perfilTelefono.value = telefono;
        if (vidTelefono && !vidTelefono.value.trim() && telefono) {
          vidTelefono.value = telefono;
        }

        if (datosPerfilNube) {
          datosPerfilNube.textContent =
            "Nombre: " + nombre +
            " | Dirección: " + (direccion || "-") +
            " | Teléfono: " + (telefono || "-") +
            " | Email: " + user.email;
        }
      })
      .catch((err) => {
        console.error("Error leyendo perfil en Firestore:", err);
      });

    db.collection("comercios").doc(user.uid).get()
      .then((doc) => {
        if (!doc.exists) {
          renderizarCuponesVidriera();
          renderizarPublicacionesVidriera();
          renderizarReflejoVidriera(null);
          return;
        }
        const com = doc.data();
        if (com.plan && PLANES_VEA[com.plan]) planActualUsuario = com.plan;
        if (vidNombreComercio) vidNombreComercio.value = com.nombreComercio || "";
        if (vidDireccion) vidDireccion.value = com.direccion || "";
        if (vidTelefono) vidTelefono.value = com.telefono || telefonoUsuarioActual || "";
        latVidriera = Number.isFinite(com.lat) ? com.lat : -34.6434;
        lngVidriera = Number.isFinite(com.lng) ? com.lng : -58.6231;
        fotoFachadaActual = com.fotoFachada || "";
        videoVerticalActual = com.videoVertical || "";
        cuponesVidriera = Array.isArray(com.cupones) ? com.cupones : [];
        publicacionesVidriera = Array.isArray(com.publicaciones) ? com.publicaciones : [];

        renderizarPreviewFachada(fotoFachadaActual);
        renderizarPreviewVideo(videoVerticalActual);
        renderizarCuponesVidriera();
        renderizarPublicacionesVidriera();
        renderizarReflejoVidriera(com);
      })
      .catch((err) => {
        console.error("Error leyendo vidriera en Firestore:", err);
      });
  } else {
    if (seccionRegistro) seccionRegistro.classList.add("hidden");
    if (seccionLogin) seccionLogin.classList.add("hidden");

    fotoPerfilActual = "";
    telefonoUsuarioActual = "";
    planActualUsuario = "basico";
    fotoFachadaActual = "";
    videoVerticalActual = "";
    cuponesVidriera = [];
    publicacionesVidriera = [];
    renderizarAvatarHeader("", "V");
    renderizarPreviewFoto("");
    renderizarPreviewFachada("");
    renderizarPreviewVideo("");
    renderizarCuponesVidriera();
    renderizarPublicacionesVidriera();
    renderizarReflejoVidriera(null);

    if (textoUsuarioHeader) textoUsuarioHeader.textContent = "Sin sesión";
    if (menuNombreUsuario) menuNombreUsuario.textContent = "Invitado";
    if (menuEmailUsuario) menuEmailUsuario.textContent = "";
    if (perfilNombre) perfilNombre.value = "";
    if (perfilDireccion) perfilDireccion.value = "";
    if (perfilTelefono) perfilTelefono.value = "";
    if (vidTelefono) vidTelefono.value = "";
    if (datosPerfilNube) {
      datosPerfilNube.textContent = "Iniciá sesión para ver tu perfil guardado en la nube.";
    }
    mostrarVista(null);
  }
});
// 8. Pantalla principal pública: mapa, buscador, grilla y detalle de vidriera
const inputBuscarComercio = document.getElementById("buscar-comercio");
const btnLimpiarBusqueda = document.getElementById("btn-limpiar-busqueda");
const contadorComercios = document.getElementById("contador-comercios");
const listaComerciosPublicos = document.getElementById("lista-comercios-publicos");
const detalleComercioPublico = document.getElementById("detalle-comercio-publico");
const contenidoDetalleComercio = document.getElementById("contenido-detalle-comercio");
const btnCerrarDetalleComercio = document.getElementById("btn-cerrar-detalle-comercio");

let comerciosCargados = [];
let mapaPrincipal = null;
let capaMarcadoresPrincipal = null;

function inicializarMapaPrincipal() {
  const cont = document.getElementById("mapa-principal");
  if (!cont || typeof L === "undefined") return;

  if (!mapaPrincipal) {
    mapaPrincipal = L.map("mapa-principal").setView([-34.6434, -58.6231], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(mapaPrincipal);
    capaMarcadoresPrincipal = L.layerGroup().addTo(mapaPrincipal);
  }
  setTimeout(() => mapaPrincipal.invalidateSize(), 180);
}

function construirHtmlVidrieraPublica(datos) {
  const telefonoVisible = (datos.telefono || "").trim();
  const waUrl = datos.whatsappUrl || formatearWhatsAppUrl(telefonoVisible);
  const badgeWhatsAppSvg = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="flex:0 0 auto;"><circle cx="12" cy="12" r="12" fill="#25D366"/><path fill="#ffffff" d="M17.47 14.38c-.28-.14-1.65-.81-1.91-.9-.26-.1-.44-.14-.63.14-.19.28-.72.9-.88 1.09-.16.19-.32.21-.6.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.39-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.63-1.52-.86-2.08-.23-.55-.46-.47-.63-.48h-.54c-.19 0-.49.07-.75.35-.26.28-.98.96-.98 2.34s1 2.71 1.14 2.9c.14.19 1.97 3.01 4.78 4.22.67.29 1.19.46 1.6.59.67.21 1.28.18 1.76.11.54-.08 1.65-.67 1.88-1.32.23-.65.23-1.21.16-1.32-.07-.12-.26-.19-.54-.33z"/></svg>`;

  const contactoWhatsAppHtml = telefonoVisible
    ? `<div style="display:inline-flex; align-items:center; gap:8px; flex-wrap:wrap; margin:6px 0 10px; padding:8px 12px; border-radius:10px; background:#f0fdf4; border:1px solid #86efac; color:#14532d; font-size:0.9rem;">
        ${badgeWhatsAppSvg}
        <span>Consultas al WhatsApp:</span>
        ${waUrl
          ? `<a href="${escaparHTML(waUrl)}" target="_blank" rel="noopener" style="font-weight:700; color:#15803d; text-decoration:underline;">${escaparHTML(telefonoVisible)}</a>`
          : `<strong>${escaparHTML(telefonoVisible)}</strong>`}
      </div>`
    : `<p class="subtexto">Consultas al WhatsApp: número no cargado.</p>`;

  const fachadaHtml = datos.fotoFachada
    ? `<img src="${datos.fotoFachada}" alt="Fachada" style="width:100%; max-height:200px; object-fit:cover; border-radius:8px; margin-bottom:10px;">`
    : "";

  const videoHtml = datos.videoVertical
    ? `<video controls playsinline src="${datos.videoVertical}" style="width:150px; max-height:260px; border-radius:8px; background:#000; display:block; margin:10px 0;"></video>`
    : "";

  const cuponesHtml = (datos.cupones || []).length
    ? `<ul>${datos.cupones.map((c) => `<li>🎟️ <strong>${escaparHTML(c.titulo)}</strong> — Código: <code>${escaparHTML(c.codigo)}</code></li>`).join("")}</ul>`
    : `<p class="subtexto">Sin cupones activos.</p>`;

  const pubsHtml = (datos.publicaciones || []).length
    ? `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:8px; margin-top:8px;">
        ${datos.publicaciones.map((p) => `
          <div style="border:1px solid #cbd5e1; border-radius:8px; padding:8px; background:#fff;">
            ${p.foto ? `<img src="${p.foto}" alt="" style="width:100%; height:110px; object-fit:cover; border-radius:6px; margin-bottom:4px;">` : ""}
            <strong>${escaparHTML(p.titulo)}</strong>
            <p class="subtexto" style="margin:2px 0 0;">${escaparHTML(p.descripcion)}</p>
          </div>
        `).join("")}
      </div>`
    : `<p class="subtexto">Sin publicaciones cargadas.</p>`;

  return `
    ${fachadaHtml}
    <h4>${escaparHTML(datos.nombreComercio)}</h4>
    <p class="subtexto">📍 ${escaparHTML(datos.direccion || "")}</p>
    ${contactoWhatsAppHtml}
    ${videoHtml}
    <strong>Cupones vigentes</strong>
    ${cuponesHtml}
    <strong style="display:block; margin-top:8px;">Publicaciones</strong>
    ${pubsHtml}
  `;
}

  function abrirDetalleComercio(comercio) {
  if (!detalleComercioPublico || !contenidoDetalleComercio || !comercio) return;
  contenidoDetalleComercio.innerHTML = construirHtmlVidrieraPublica(comercio);
  detalleComercioPublico.classList.remove("hidden");
  if (mapaPrincipal && Number.isFinite(comercio.lat) && Number.isFinite(comercio.lng)) {
    mapaPrincipal.setView([comercio.lat, comercio.lng], 16);
  }
  detalleComercioPublico.scrollIntoView({ behavior: "smooth", block: "nearest" });

const idComercioActual = comercio.id || comercio.uid || comercio.comercioId || "";
  if (typeof renderContadorVisitas === "function") {
    renderContadorVisitas({ vistasHoy: 0, vistasTotales: 0 });
  }
  if (idComercioActual && typeof registrarYLeerVistasVidriera === "function") {
    registrarYLeerVistasVidriera(comercio)
      .then((metricas) => {
        if (metricas && typeof renderContadorVisitas === "function") {
          renderContadorVisitas(metricas);
        }
      })
      .catch((err) => {
        console.error("Error al registrar vista real:", err);
      });
  }
  }
function renderizarComerciosPublicos(lista) {
  inicializarMapaPrincipal();
  if (capaMarcadoresPrincipal) {
    capaMarcadoresPrincipal.clearLayers();
  }

  if (contadorComercios) {
    contadorComercios.textContent = lista.length === 1
      ? "1 comercio encontrado."
      : `${lista.length} comercios encontrados.`;
  }

  if (!listaComerciosPublicos) return;
  listaComerciosPublicos.innerHTML = "";

  if (!lista.length) {
    listaComerciosPublicos.innerHTML = `<p class="subtexto">No hay comercios que coincidan con la búsqueda.</p>`;
    return;
  }

  const limites = [];

  lista.forEach((com) => {
    if (Number.isFinite(com.lat) && Number.isFinite(com.lng) && capaMarcadoresPrincipal) {
      const marker = L.marker([com.lat, com.lng]).addTo(capaMarcadoresPrincipal);
      marker.bindPopup(`<strong>${escaparHTML(com.nombreComercio)}</strong><br>${escaparHTML(com.direccion || "")}`);
      marker.on("click", () => abrirDetalleComercio(com));
      limites.push([com.lat, com.lng]);
    }

    const cantCupones = Array.isArray(com.cupones) ? com.cupones.length : 0;
    const cantPubs = Array.isArray(com.publicaciones) ? com.publicaciones.length : 0;
    const waUrl = com.whatsappUrl || formatearWhatsAppUrl(com.telefono || "");
const hoyArgCard = typeof obtenerFechaHoyArg === "function" ? obtenerFechaHoyArg() : "";
  const vistasHoyCard = com.fechaUltimaVista === hoyArgCard ? Number(com.vistasHoy || 0) : 0;
  const vistasTotalCard = Number(com.vistasTotales || 0);
    const card = document.createElement("article");
    card.className = "comercio-card";
    card.innerHTML = `
      <div>
        ${com.fotoFachada
          ? `<img src="${com.fotoFachada}" alt="${escaparHTML(com.nombreComercio)}" class="comercio-card-img">`
          : `<div class="comercio-card-img" style="display:flex; align-items:center; justify-content:center; color:#f3d56b; font-weight:700;">VEA APP</div>`}
        <div class="comercio-card-body">
          <h4 class="comercio-card-titulo">${escaparHTML(com.nombreComercio)}</h4>
          <p class="subtexto">📍 ${escaparHTML(com.direccion || "")}</p>
          ${com.telefono ? `<p class="subtexto">📱 WhatsApp: <strong>${escaparHTML(com.telefono)}</strong></p>` : ""}
          <div class="comercio-badges">
          <span style="display:inline-flex; align-items:center; gap:6px; background:#0f2e22; color:#f4f7f5; border:1px solid #c59b27; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; line-height:1.2;"><span style="color:#c59b27;">👁</span><span>${vistasHoyCard.toLocaleString("es-AR")}</span><span style="color:#c59b27; font-weight:600;">hoy</span><span style="color:#c59b27;">·</span><span>${vistasTotalCard.toLocaleString("es-AR")}</span><span style="color:#c59b27; font-weight:600;">total</span></span>
            <span class="badge-vea">🎟️ ${cantCupones} cupón${cantCupones === 1 ? "" : "es"}</span>
            <span class="badge-vea">📰 ${cantPubs} pub${cantPubs === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>
      <div class="comercio-card-acciones">
        <button type="button" class="btn-ver-vidriera">Ver vidriera</button>
        ${waUrl ? `<a href="${escaparHTML(waUrl)}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; padding:8px 12px; border-radius:8px; background:#16a34a; color:#fff; font-weight:700; text-decoration:none; font-size:0.85rem;">WhatsApp</a>` : ""}
      </div>
    `;

    const btnVer = card.querySelector(".btn-ver-vidriera");
    if (btnVer) {
      btnVer.addEventListener("click", () => abrirDetalleComercio(com));
    }

    listaComerciosPublicos.appendChild(card);
  });

  if (mapaPrincipal && limites.length > 1) {
    mapaPrincipal.fitBounds(limites, { padding: [24, 24], maxZoom: 15 });
  } else if (mapaPrincipal && limites.length === 1) {
    mapaPrincipal.setView(limites[0], 15);
  }
}

function normalizarTextoVEA(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function obtenerInfoPlanVEA(com) {
  const raw = normalizarTextoVEA((com && (com.plan || com.tipoPlan)) || "basico");
  if (raw.includes("premium")) {
    return { peso: 3, etiqueta: "👑 PREMIUM", badgeBg: "#c59b27", badgeColor: "#0f2e22" };
  }
  if (raw.includes("estandar") || raw.includes("standard")) {
    return { peso: 2, etiqueta: "ESTÁNDAR", badgeBg: "#15803d", badgeColor: "#ffffff" };
  }
  return { peso: 1, etiqueta: "BÁSICO", badgeBg: "#334155", badgeColor: "#f8fafc" };
}

function obtenerPesoPlan(com) {
  return obtenerInfoPlanVEA(com).peso;
}

function actualizarBadgeResultados(cantidad, mostrar) {
  const badge = document.getElementById("badgeContadorRubro");
  if (!badge) return;
  const total = Number(cantidad) || 0;
  badge.textContent = String(total);
  badge.style.display = mostrar && total > 0 ? "inline-block" : "none";
}

function obtenerRubrosOficialesVEA() {
  const setRubros = new Set();
  if (typeof DICCCIONARIO_PALABRAS_RUBRO === "object" && DICCCIONARIO_PALABRAS_RUBRO) {
    Object.keys(DICCCIONARIO_PALABRAS_RUBRO).forEach((r) => r && setRubros.add(String(r).trim()));
  }
  if (typeof DICCIONARIO_PALABRAS_RUBRO === "object" && DICCIONARIO_PALABRAS_RUBRO) {
    Object.keys(DICCIONARIO_PALABRAS_RUBRO).forEach((r) => r && setRubros.add(String(r).trim()));
  }
  if (Array.isArray(comerciosCargados)) {
    comerciosCargados.forEach((c) => {
      if (c && c.rubro) setRubros.add(String(c.rubro).trim());
    });
  }
  return Array.from(setRubros);
}

function resolverRubroSugeridoVEA(consultaRaw) {
  const q = normalizarTextoVEA(consultaRaw);
  if (!q) return null;

  const rubros = obtenerRubrosOficialesVEA();
  const qCompacta = q.replace(/(.)\1+/g, "$1");

  for (const rubro of rubros) {
    const rNorm = normalizarTextoVEA(rubro);
    const rCompacta = rNorm.replace(/(.)\1+/g, "$1");
    if (rNorm.startsWith(q) || rNorm.includes(q) || rCompacta.startsWith(qCompacta) || rCompacta.includes(qCompacta)) {
      return rubro;
    }
  }

  const dic = (typeof DICCCIONARIO_PALABRAS_RUBRO === "object" && DICCCIONARIO_PALABRAS_RUBRO)
    ? DICCCIONARIO_PALABRAS_RUBRO
    : ((typeof DICCIONARIO_PALABRAS_RUBRO === "object" && DICCIONARIO_PALABRAS_RUBRO) ? DICCIONARIO_PALABRAS_RUBRO : null);

  if (dic) {
    for (const [rubro, palabras] of Object.entries(dic)) {
      if (!Array.isArray(palabras)) continue;
      for (const p of palabras) {
        const pNorm = normalizarTextoVEA(p);
        const pCompacta = pNorm.replace(/(.)\1+/g, "$1");
        if (pNorm.startsWith(q) || pNorm.includes(q) || pCompacta.startsWith(qCompacta)) {
          return rubro;
        }
      }
    }
  }
  return null;
}

function aplicarFiltroComerciosVEA(terminoRaw, opciones = {}) {
  const { desdeRubro = false, mostrarBadge = true } = opciones;
  const termino = normalizarTextoVEA(terminoRaw);
  const ordenadosBase = [...comerciosCargados].sort((a, b) => obtenerPesoPlan(b) - obtenerPesoPlan(a));

  if (!termino) {
    window.__ultimosResultadosOrdenados = ordenadosBase;
    window.__ultimoTerminoFiltroVEA = "";
    actualizarBadgeResultados(0, false);
    renderizarComerciosPublicos(ordenadosBase);
    return ordenadosBase;
  }

  const sugerencia = resolverRubroSugeridoVEA(termino);
  const sugerenciaNorm = sugerencia ? normalizarTextoVEA(sugerencia) : "";

  const filtrados = ordenadosBase
    .filter((com) => {
      const rubroNorm = normalizarTextoVEA(com.rubro || "");
      if (desdeRubro) {
        return rubroNorm.includes(termino) || (sugerenciaNorm && rubroNorm === sugerenciaNorm);
      }
      const textoCupones = (com.cupones || []).map((c) => `${c.titulo || ""} ${c.codigo || ""}`).join(" ");
      const textoPubs = (com.publicaciones || []).map((p) => `${p.titulo || ""} ${p.descripcion || ""}`).join(" ");
      const campoCompleto = normalizarTextoVEA(
        `${com.nombreComercio || ""} ${com.rubro || ""} ${com.direccion || ""} ${com.telefono || ""} ${textoCupones} ${textoPubs}`
      );
      const campoCompacto = campoCompleto.replace(/(.)\1+/g, "$1");
      const terminoCompacto = termino.replace(/(.)\1+/g, "$1");

      return (
        campoCompleto.includes(termino) ||
        campoCompacto.includes(terminoCompacto) ||
        (sugerenciaNorm && campoCompleto.includes(sugerenciaNorm))
      );
    })
    .sort((a, b) => obtenerPesoPlan(b) - obtenerPesoPlan(a));

  window.__ultimosResultadosOrdenados = filtrados;
  window.__ultimoTerminoFiltroVEA = sugerencia || terminoRaw.trim();
  actualizarBadgeResultados(filtrados.length, mostrarBadge);
  renderizarComerciosPublicos(filtrados);
  return filtrados;
}

function filtrarComercios() {
  const valor = (typeof inputBuscarComercio !== "undefined" && inputBuscarComercio) ? inputBuscarComercio.value : "";
  aplicarFiltroComerciosVEA(valor, { desdeRubro: false, mostrarBadge: true });
}

if (inputBuscarComercio) {
  inputBuscarComercio.addEventListener("input", filtrarComercios);
}

if (btnLimpiarBusqueda) {
  btnLimpiarBusqueda.addEventListener("click", () => {
    if (inputBuscarComercio) inputBuscarComercio.value = "";
    renderizarComerciosPublicos(comerciosCargados);
  });
}

if (btnCerrarDetalleComercio && detalleComercioPublico) {
  btnCerrarDetalleComercio.addEventListener("click", () => {
    detalleComercioPublico.classList.add("hidden");
  });
}

db.collection("comercios").onSnapshot((snapshot) => {
  comerciosCargados = [];
  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    if (data.nombreComercio) {
      comerciosCargados.push({ id: doc.id, ...data });
    }
  });
  filtrarComercios();
}, (err) => {
  console.error("Error leyendo comercios públicos:", err);
  if (contadorComercios) {
    contadorComercios.textContent = "No se pudieron cargar los comercios.";
  }
});
(() => {
  const btnSeguirEl = document.getElementById("btn-seguir-comercio");
  const contadorSeguidoresEl = document.getElementById("contador-seguidores-comercio");
  const detalleBoxEl = document.getElementById("detalle-comercio-publico");

  if (!btnSeguirEl || !contadorSeguidoresEl) return;

  let comercioSeguidoActual = null;

  function obtenerIdSeguidor() {
    try {
      if (typeof auth !== "undefined" && auth && auth.currentUser && auth.currentUser.uid) {
        return `uid_${auth.currentUser.uid}`;
      }
    } catch (_e) {}

    let anonId = "";
    try {
      anonId = localStorage.getItem("vea_visitor_id") || "";
      if (!anonId) {
        anonId = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        localStorage.setItem("vea_visitor_id", anonId);
      }
    } catch (_e) {
      anonId = "anon_fallback";
    }
    return anonId;
  }

  function leerSeguidosLocales() {
    try {
      const raw = JSON.parse(localStorage.getItem("vea_comercios_seguidos") || "[]");
      return Array.isArray(raw) ? raw.map(String) : [];
    } catch (_e) {
      return [];
    }
  }

  function guardarSeguidosLocales(lista) {
    try {
      localStorage.setItem("vea_comercios_seguidos", JSON.stringify(Array.from(new Set(lista.map(String)))));
    } catch (_e) {}
  }

  function pintarBotonSeguidores(total, siguiendo) {
    const cant = Math.max(0, Number(total) || 0);
    contadorSeguidoresEl.textContent = cant === 1 ? "1 seguidor" : `${cant} seguidores`;
    btnSeguirEl.classList.toggle("siguiendo", Boolean(siguiendo));
    btnSeguirEl.textContent = siguiendo ? "✓ Siguiendo" : "+ Seguir";
  }

  function buscarComercioPorId(id) {
    if (!id) return null;
    const lista = (typeof comerciosCargados !== "undefined" && Array.isArray(comerciosCargados))
      ? comerciosCargados
      : [];
    return lista.find((c) => String(c.id || c.uid || "") === String(id)) || null;
  }

  async function cargarSeguidoresParaComercio(comercio) {
    if (!comercio || !comercio.id) return;
    comercioSeguidoActual = comercio;
    const comId = String(comercio.id);
    const seguidorId = obtenerIdSeguidor();

    let total = Number(comercio.totalSeguidores) || 0;
    let siguiendo = leerSeguidosLocales().includes(comId);
    pintarBotonSeguidores(total, siguiendo);

    if (typeof db !== "undefined" && db) {
      try {
        const docRef = db.collection("comercios").doc(comId);
        const [comSnap, segSnap] = await Promise.all([
          docRef.get(),
          docRef.collection("seguidores").doc(seguidorId).get()
        ]);

        if (comSnap.exists && typeof comSnap.data()?.totalSeguidores === "number") {
          total = comSnap.data().totalSeguidores;
          comercio.totalSeguidores = total;
        }
        siguiendo = segSnap.exists;

        const locales = leerSeguidosLocales();
        if (siguiendo && !locales.includes(comId)) {
          guardarSeguidosLocales([...locales, comId]);
        } else if (!siguiendo && locales.includes(comId)) {
          guardarSeguidosLocales(locales.filter((x) => x !== comId));
        }

        if (comercioSeguidoActual && String(comercioSeguidoActual.id) === comId) {
          pintarBotonSeguidores(total, siguiendo);
        }
      } catch (_e) {}
    }
  }

  btnSeguirEl.addEventListener("click", async () => {
    if (!comercioSeguidoActual || !comercioSeguidoActual.id) return;
    const comId = String(comercioSeguidoActual.id);
    const seguidorId = obtenerIdSeguidor();
    const yaSiguiendo = btnSeguirEl.classList.contains("siguiendo");
    const nuevoEstado = !yaSiguiendo;

    const totalActual = Math.max(0, Number(comercioSeguidoActual.totalSeguidores) || 0);
    const nuevoTotal = Math.max(0, totalActual + (nuevoEstado ? 1 : -1));
    comercioSeguidoActual.totalSeguidores = nuevoTotal;

    const locales = leerSeguidosLocales();
    if (nuevoEstado) {
      guardarSeguidosLocales([...locales, comId]);
    } else {
      guardarSeguidosLocales(locales.filter((x) => x !== comId));
    }

    pintarBotonSeguidores(nuevoTotal, nuevoEstado);

    if (typeof db !== "undefined" && db) {
      try {
        const docRef = db.collection("comercios").doc(comId);
        const segRef = docRef.collection("seguidores").doc(seguidorId);
        if (nuevoEstado) {
          await segRef.set({
            uid: (typeof auth !== "undefined" && auth?.currentUser?.uid) ? auth.currentUser.uid : "",
            creadoEn: Date.now()
          });
        } else {
          await segRef.delete();
        }
        await docRef.set({ totalSeguidores: nuevoTotal }, { merge: true });
      } catch (_e) {}
    }
  });

  if (detalleBoxEl && typeof MutationObserver !== "undefined") {
    const obs = new MutationObserver(() => {
      if (!detalleBoxEl.classList.contains("hidden")) {
        const lista = (typeof comerciosCargados !== "undefined" && Array.isArray(comerciosCargados))
          ? comerciosCargados
          : [];
        if (lista.length && !comercioSeguidoActual) {
          const textoDetalle = (detalleBoxEl.textContent || "").toLowerCase();
          const match = lista.find((c) => {
            const nom = String(c.nombreComercio || c.nombre || "").trim().toLowerCase();
            return nom && textoDetalle.includes(nom);
          });
          if (match) cargarSeguidoresParaComercio(match);
        }
      } else {
        comercioSeguidoActual = null;
      }
    });
    obs.observe(detalleBoxEl, { attributes: true, attributeFilter: ["class"] });
  }

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-comercio-id], [data-id], [data-popup-vidriera-id], .card-vidriera");
    if (!trigger) return;
    const id = trigger.getAttribute("data-comercio-id")
      || trigger.getAttribute("data-id")
      || trigger.getAttribute("data-popup-vidriera-id")
      || "";
    const encontrada = buscarComercioPorId(id);
    if (encontrada) {
      setTimeout(() => cargarSeguidoresParaComercio(encontrada), 80);
    }
  });
})();
const VEA_BACKEND_URL = "https://veaapp-1e.onrender.com";

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-suscripcion");
  if (!btn) return;

  const plan = btn.dataset.plan;
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generando pago...";

  try {
    const resp = await fetch(`${VEA_BACKEND_URL}/api/crear-preferencia`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan })
    });

    const data = await resp.json();
    const urlPago = data.init_point || data.sandbox_init_point || data.url;

    if (resp.ok && urlPago) {
      window.location.href = urlPago;
    } else {
      alert(data.error || "No se pudo generar el link de pago.");
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
    async function verificarRetornoMercadoPago() {
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get("payment_id") || params.get("collection_id");
  const status = params.get("status") || params.get("collection_status");

  if (!paymentId) return;

  if (status && status !== "approved") {
    alert(`El pago no fue aprobado (estado: ${status}).`);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    return;
  }

  try {
    const resp = await fetch(`${VEA_BACKEND_URL}/api/verificar-pago?payment_id=${encodeURIComponent(paymentId)}`);
    const data = await resp.json();

    if (resp.ok && data.aprobado && data.plan) {
      await aplicarPlanActivadoEnApp(data.plan, data.payment_id);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    } else {
      alert("No pudimos confirmar el pago aprobado todavía.");
    }
  } catch (err) {
    console.error("Error verificando retorno de pago:", err);
  }
}

// Definí acá la fecha YYYY-MM-DD cuando fijen el lanzamiento oficial.
// Mientras sea null, no corta la ventana de promo por fecha fija.
const FECHA_LANZAMIENTO_OFICIAL = null;

function promoPrimerMesDisponible(fechaReferencia = new Date()) {
  if (!FECHA_LANZAMIENTO_OFICIAL) return true;

  const inicio = new Date(`${FECHA_LANZAMIENTO_OFICIAL}T00:00:00`);
  if (Number.isNaN(inicio.getTime())) return true;

  const finVentanaPromo = new Date(inicio);
  finVentanaPromo.setMonth(finVentanaPromo.getMonth() + 3);

  return fechaReferencia >= inicio && fechaReferencia <= finVentanaPromo;
}

function calcularProximoVencimientoAnclado(diaCiclo, desdeFecha = new Date()) {
  const base = new Date(desdeFecha.getTime());
  const anio = base.getFullYear();
  const mes = base.getMonth();

  // Si el día de ciclo de este mes aún no pasó, vence en el día de ciclo de este mes;
  // si ya pasó o es hoy, pasa al mes siguiente respetando el día de ciclo (ajustando fin de mes).
  let targetAnio = anio;
  let targetMes = mes;

  const candidatoEsteMes = construirFechaConDia(anio, mes, diaCiclo, base);
  if (candidatoEsteMes <= base) {
    targetMes += 1;
    if (targetMes > 11) {
      targetMes = 0;
      targetAnio += 1;
    }
  }

  return construirFechaConDia(targetAnio, targetMes, diaCiclo, base);
}

function construirFechaConDia(anio, mes, diaDeseado, horaReferencia) {
  const ultimoDiaDelMes = new Date(anio, mes + 1, 0).getDate();
  const diaSeguro = Math.min(Math.max(Number(diaDeseado) || 1, 1), ultimoDiaDelMes);
  return new Date(
    anio,
    mes,
    diaSeguro,
    horaReferencia.getHours(),
    horaReferencia.getMinutes(),
    horaReferencia.getSeconds()
  );
}

function calcularDatosSuscripcion(datosActuales = {}, ahora = new Date()) {
  const vencimientoActual = datosActuales.planVenceEn
    ? new Date(datosActuales.planVenceEn)
    : null;
  const tieneVencimientoValido = vencimientoActual && !Number.isNaN(vencimientoActual.getTime());

  const estaVencidoPorFecha = tieneVencimientoValido ? ahora > vencimientoActual : false;
  const estaVencidoPorEstado = datosActuales.estadoSuscripcion === "vencida";
  const huboCorteReal = estaVencidoPorFecha || estaVencidoPorEstado;

  // Caso 1: Hubo corte real -> arranca ciclo nuevo de 30 días desde la fecha de pago/reactivación
  if (huboCorteReal || !datosActuales.diaCiclo) {
    const nuevoDiaCiclo = ahora.getDate();
    const nuevoVencimiento = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      diaCiclo: nuevoDiaCiclo,
      planVenceEn: nuevoVencimiento.toISOString(),
      estadoSuscripcion: "activa",
      modoCiclo: huboCorteReal ? "reactivacion_30_dias" : "alta_inicial_30_dias"
    };
  }

  // Caso 2: Está vigente o dentro de su ciclo -> mantiene día de ciclo y calcula el próximo corte anclado
  const diaCicloAnclado = Number(datosActuales.diaCiclo);
  const baseCalculo = tieneVencimientoValido && vencimientoActual > ahora
    ? vencimientoActual
    : ahora;
  const proximoVencimiento = calcularProximoVencimientoAnclado(diaCicloAnclado, baseCalculo);

  return {
    diaCiclo: diaCicloAnclado,
    planVenceEn: proximoVencimiento.toISOString(),
    estadoSuscripcion: "activa",
    modoCiclo: "aniversario_anclado"
  };
}

async function aplicarPlanActivadoEnApp(plan, paymentId) {
  const planNormalizado = String(plan || "").toLowerCase();
  const dbRef = (typeof db !== "undefined") ? db : firebase.firestore();
  const usuario = (typeof firebase !== "undefined" && firebase.auth) ? firebase.auth().currentUser : null;

  if (!usuario) {
    alert(`Pago confirmado (${planNormalizado.toUpperCase()}). Iniciá sesión para vincular el plan a tu comercio.`);
    return;
  }

  try {
    let docRef = null;
    let datosActuales = {};

    const docDirecto = dbRef.collection("comercios").doc(usuario.uid);
    const snapDirecto = await docDirecto.get();

    if (snapDirecto.exists) {
      docRef = docDirecto;
      datosActuales = snapDirecto.data() || {};
    } else if (usuario.email) {
      const querySnap = await dbRef.collection("comercios")
        .where("email", "==", usuario.email)
        .limit(1)
        .get();

      if (!querySnap.empty) {
        docRef = querySnap.docs[0].ref;
        datosActuales = querySnap.docs[0].data() || {};
      }
    }

    if (!docRef) {
      alert("El pago se aprobó, pero no se encontró un comercio asociado a tu usuario.");
      return;
    }

    const ahora = new Date();
    const calculo = calcularDatosSuscripcion(datosActuales, ahora);

    await docRef.update({
      plan: planNormalizado,
      planVenceEn: calculo.planVenceEn,
      diaCiclo: calculo.diaCiclo,
      estadoSuscripcion: calculo.estadoSuscripcion,
      ultimoPagoId: paymentId,
      actualizadoEn: ahora.toISOString()
    });

    alert(`¡Listo! Tu plan ${planNormalizado.toUpperCase()} quedó activo hasta el ${new Date(calculo.planVenceEn).toLocaleDateString("es-AR")}.`);
  } catch (err) {
    console.error("Error guardando el plan en Firestore:", err);
    alert("El pago se aprobó, pero hubo un problema al guardar el plan en la base.");
  }
}

document.addEventListener("DOMContentLoaded", verificarRetornoMercadoPago);
  } catch (err) {
    console.error("Error al crear preferencia:", err);
    alert("Error de conexión con el servidor de pagos.");
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
});
inicializarMapaPrincipal();
(function initAyudanosMejorar() {
  const btnAbrir = document.getElementById("btnAyudanosMejorarNav");
  const modal = document.getElementById("modal-ayudanos-mejorar");
  const btnCerrar = document.getElementById("btnCerrarModalMejora");
  const btnEnviar = document.getElementById("btnEnviarSugerenciaMejora");
  const txtSugerencia = document.getElementById("txtSugerenciaMejora");
  const estadoSugerencia = document.getElementById("estadoSugerenciaMejora");

  if (!btnAbrir || !modal) return;

  const cerrarModal = () => {
    modal.classList.add("hidden");
    if (estadoSugerencia) estadoSugerencia.textContent = "";
  };

  btnAbrir.addEventListener("click", () => {
    if (estadoSugerencia) estadoSugerencia.textContent = "";
    modal.classList.remove("hidden");
    if (txtSugerencia) txtSugerencia.focus();
  });

  if (btnCerrar) btnCerrar.addEventListener("click", cerrarModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) cerrarModal();
  });

  if (btnEnviar) {
    btnEnviar.addEventListener("click", async () => {
      const comentario = (txtSugerencia ? txtSugerencia.value : "").trim();
      if (!comentario) {
        if (estadoSugerencia) estadoSugerencia.textContent = "Escribí un comentario antes de enviar.";
        return;
      }

      if (typeof db === "undefined" || !db) {
        if (estadoSugerencia) estadoSugerencia.textContent = "No hay conexión con la base de datos.";
        return;
      }

      btnEnviar.disabled = true;
      if (estadoSugerencia) estadoSugerencia.textContent = "Enviando...";

      try {
        const currentUser = (typeof auth !== "undefined" && auth && auth.currentUser) ? auth.currentUser : null;
        await db.collection("sugerencias_mejora").add({
          comentario,
          privado: true,
          uid: currentUser ? currentUser.uid : null,
          email: currentUser ? currentUser.email : null,
          creadoEn: new Date().toISOString()
        });

        if (txtSugerencia) txtSugerencia.value = "";
        if (estadoSugerencia) estadoSugerencia.textContent = "¡Gracias! Tu comentario se guardó de forma privada.";
        setTimeout(cerrarModal, 900);
      } catch (err) {
        console.error("Error guardando sugerencia:", err);
        if (estadoSugerencia) estadoSugerencia.textContent = "No se pudo enviar. Intentá de nuevo.";
      } finally {
        btnEnviar.disabled = false;
      }
    });
  }
})();
(function initBotonListaRubro() {
  const btnLista = document.getElementById("btnResultadosRubroNav");
  if (!btnLista) return;

  btnLista.addEventListener("click", () => {
    const lista = Array.isArray(window.__ultimosResultadosOrdenados)
      ? window.__ultimosResultadosOrdenados
      : [...comerciosCargados].sort((a, b) => obtenerPesoPlan(b) - obtenerPesoPlan(a));

    renderizarComerciosPublicos(lista);
    if (typeof listaComerciosPublicos !== "undefined" && listaComerciosPublicos) {
      listaComerciosPublicos.classList.remove("hidden");
      listaComerciosPublicos.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
})();
(function initVistaListaYBuscadorVEA() {
  const btnLista = document.getElementById("btnResultadosRubroNav");
  if (!btnLista) return;

  function asegurarPanelLista() {
    let panel = document.getElementById("panel-lista-vea-opcion1");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "panel-lista-vea-opcion1";
    panel.style.cssText = [
      "position:fixed",
      "left:12px",
      "right:12px",
      "bottom:72px",
      "max-height:66vh",
      "overflow-y:auto",
      "background:#0f2e22",
      "color:#ecfdf5",
      "border:1px solid #2d6a4f",
      "border-radius:14px",
      "box-shadow:0 14px 34px rgba(0,0,0,0.45)",
      "padding:14px",
      "z-index:9999",
      "display:none"
    ].join(";");

    panel.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; border-bottom:1px solid #2d6a4f; padding-bottom:10px; margin-bottom:12px;">
        <strong id="titulo-panel-lista-vea" style="font-size:15px; color:#facc15;">Lista de comercios</strong>
        <button type="button" id="btn-cerrar-panel-lista-vea" style="cursor:pointer; padding:5px 12px; border-radius:8px; border:1px solid #c59b27; background:#1b4332; color:#ecfdf5; font-weight:600;">Cerrar</button>
      </div>
      <div id="cuerpo-panel-lista-vea"></div>
    `;

    document.body.appendChild(panel);
    panel.querySelector("#btn-cerrar-panel-lista-vea").addEventListener("click", () => {
      panel.style.display = "none";
    });
    return panel;
  }

  function renderizarPanelLista() {
    const panel = asegurarPanelLista();
    const cuerpo = panel.querySelector("#cuerpo-panel-lista-vea");
    const titulo = panel.querySelector("#titulo-panel-lista-vea");

    const fuente = Array.isArray(window.__ultimosResultadosOrdenados) && window.__ultimosResultadosOrdenados.length
      ? window.__ultimosResultadosOrdenados
      : (typeof comerciosCargados !== "undefined" && Array.isArray(comerciosCargados) ? comerciosCargados : []);

    const listaOrdenada = [...fuente].sort((a, b) => obtenerInfoPlanVEA(b).peso - obtenerInfoPlanVEA(a).peso);
    const etiquetaFiltro = window.__ultimoTerminoFiltroVEA || "";

    titulo.textContent = etiquetaFiltro
      ? `Lista de comercios · "${etiquetaFiltro}" (${listaOrdenada.length})`
      : `Lista de comercios (${listaOrdenada.length})`;

    if (!listaOrdenada.length) {
      cuerpo.innerHTML = `<p style="margin:0; color:#a7f3d0;">No se encontraron comercios para mostrar.</p>`;
      panel.style.display = "block";
      return;
    }

    cuerpo.innerHTML = "";
    listaOrdenada.forEach((com) => {
      const plan = obtenerInfoPlanVEA(com);
      const fila = document.createElement("div");
      fila.style.cssText = [
        "display:flex",
        "align-items:center",
        "justify-content:space-between",
        "gap:10px",
        "background:#162232",
        "border:1px solid #2d6a4f",
        "border-radius:12px",
        "padding:10px",
        "margin-bottom:10px",
        "cursor:pointer"
      ].join(";");

      const mini = document.createElement("div");
      mini.style.cssText = "width:46px; height:46px; border-radius:10px; background:#1b4332; border:1px solid #40916c; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;";
      mini.textContent = "🏪";

      const info = document.createElement("div");
      info.style.cssText = "flex:1; min-width:0;";

      const nombre = com.nombreComercio || com.nombre || "Comercio sin nombre";
      const rubro = com.rubro || "Sin rubro";
      const dir = com.direccion || "Sin dirección";

      info.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:3px;">
          <span style="font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; background:${plan.badgeBg}; color:${plan.badgeColor};">${plan.etiqueta}</span>
        </div>
        <div style="font-weight:700; font-size:14px; color:#ffffff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${nombre}</div>
        <div style="font-size:12px; color:#86efac; margin-top:2px;">🏷️ ${rubro}</div>
        <div style="font-size:12px; color:#cbd5e1; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📍 ${dir}</div>
      `;

      const flecha = document.createElement("span");
      flecha.textContent = "›";
      flecha.style.cssText = "font-size:22px; color:#facc15; font-weight:700; padding-left:4px;";

      fila.appendChild(mini);
      fila.appendChild(info);
      fila.appendChild(flecha);

      fila.addEventListener("click", () => {
        panel.style.display = "none";
        if (typeof abrirDetalleComercio === "function") {
          abrirDetalleComercio(com);
        }
      });

      cuerpo.appendChild(fila);
    });

    panel.style.display = "block";
  }

  btnLista.addEventListener("click", (e) => {
    e.preventDefault();
    renderizarPanelLista();
  });

  if (typeof inputBuscarComercio !== "undefined" && inputBuscarComercio) {
    let cajaSug = document.getElementById("sugerencias-rubro-vea");
    if (!cajaSug) {
      cajaSug = document.createElement("div");
      cajaSug.id = "sugerencias-rubro-vea";
      cajaSug.style.cssText = "display:none; margin-top:6px; background:#0f2e22; border:1px solid #40916c; border-radius:10px; padding:6px 10px; color:#ecfdf5; font-size:13px;";
      inputBuscarComercio.insertAdjacentElement("afterend", cajaSug);
    }

    const actualizarSugerencia = () => {
      const actual = inputBuscarComercio.value.trim();
      if (!actual) {
        cajaSug.style.display = "none";
        return;
      }
      const sug = resolverRubroSugeridoVEA(actual);
      if (sug && normalizarTextoVEA(sug) !== normalizarTextoVEA(actual)) {
        cajaSug.innerHTML = `¿Quisiste decir <button type="button" id="btn-aplicar-sugerencia-vea" style="background:#15803d; color:#fff; border:1px solid #86efac; border-radius:6px; padding:2px 8px; margin-left:4px; cursor:pointer; font-weight:700;">${sug}</button>?`;
        cajaSug.style.display = "block";
        const btnAplicar = document.getElementById("btn-aplicar-sugerencia-vea");
        if (btnAplicar) {
          btnAplicar.addEventListener("click", () => {
            inputBuscarComercio.value = sug;
            cajaSug.style.display = "none";
            aplicarFiltroComerciosVEA(sug, { desdeRubro: true, mostrarBadge: true });
          });
        }
      } else {
        cajaSug.style.display = "none";
      }
    };

    inputBuscarComercio.addEventListener("input", actualizarSugerencia);
  }

  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-rubro], .chip-rubro, .item-rubro, .btn-rubro");
    if (!target) return;
    const rubroElegido = (target.dataset && target.dataset.rubro) || target.textContent || "";
    const limpio = rubroElegido.trim();
    if (limpio && limpio.toLowerCase() !== "rubros" && limpio.toLowerCase() !== "todos") {
      aplicarFiltroComerciosVEA(limpio, { desdeRubro: true, mostrarBadge: true });
    }
  });
})();
let estadoNotificacionesBarraVEA = [];

function obtenerContenedorBarraInferiorVEA() {
  const selectores = [
    ".bottom-nav",
    ".barra-inferior",
    ".menu-inferior",
    ".nav-inferior",
    ".footer-nav",
    "footer nav",
    "nav.fixed-bottom",
    "nav[data-barra='inferior']"
  ];

  for (const sel of selectores) {
    const el = document.querySelector(sel);
    if (el) return el;
  }

  // Respaldo si la barra inferior no tiene clase específica
  const navs = Array.from(document.querySelectorAll("nav"));
  const navInferior = navs.find((n) => {
    const rect = n.getBoundingClientRect();
    return rect.bottom >= window.innerHeight - 120 && rect.height <= 90;
  });
  if (navInferior) return navInferior;

  let creada = document.querySelector("#barra-inferior-vea");
  if (!creada) {
    creada = document.createElement("nav");
    creada.id = "barra-inferior-vea";
    creada.style.cssText =
      "position:fixed; bottom:0; left:0; right:0; height:58px; background:#0f2e22; border-top:1px solid #c59b27; display:flex; align-items:center; justify-content:space-around; z-index:9990;";
    document.body.appendChild(creada);
  }
  return creada;
}

function insertarAlLadoDeInicioVEA(barra, itemNotif) {
  if (!itemNotif) return;

  if (barra && typeof barra.querySelectorAll === "function") {
    const previos = barra.querySelectorAll("#item-campanita-inferior-vea");
    previos.forEach((el) => {
      if (el !== itemNotif) el.remove();
    });
  }

  document.querySelectorAll("#item-campanita-inferior-vea").forEach((el) => {
    if (el !== itemNotif) el.remove();
  });

  if (!itemNotif.isConnected && document.body) {
    document.body.appendChild(itemNotif);
  }
}
  const candidatos = Array.from(barra.querySelectorAll("a, button, .nav-item, [role='button']"));
  const botonInicio = candidatos.find((el) => {
    const texto = (el.textContent || "").trim().toLowerCase();
    const idOCalse = `${el.id || ""} ${el.className || ""}`.toLowerCase();
    return (
      texto.includes("inicio") ||
      texto.includes("home") ||
      idOCalse.includes("inicio") ||
      idOCalse.includes("home")
    );
  });

  if (botonInicio && botonInicio.parentNode === barra) {
    botonInicio.insertAdjacentElement("afterend", itemNotif);
    return;
  }

  if (botonInicio && botonInicio.parentNode) {
    botonInicio.parentNode.insertAdjacentElement("afterend", itemNotif);
    return;
  }

  barra.appendChild(itemNotif);


function inicializarCampanitaBarraInferiorVEA() {
  let item = document.querySelector("#item-campanita-inferior-vea");
  if (!item) {
    item = document.createElement("div");
    item.id = "item-campanita-inferior-vea";
  }

  item.style.cssText = `
    position: fixed;
    top: 14px;
    right: 14px;
    z-index: 1300;
    display: none;
    align-items: center;
    justify-content: center;
    background: #062e22;
    border: 1px solid rgba(212, 175, 55, 0.65);
    border-radius: 999px;
    padding: 6px 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
  `;

  item.innerHTML = `
    <button id="btn-campanita-inferior-vea" type="button" aria-label="Notificaciones"
      style="position:relative; display:inline-flex; flex-direction:row; align-items:center; justify-content:center; gap:5px; background:transparent; border:none; padding:0; cursor:pointer; color:#f4f7f5;">
      <span style="position:relative; display:inline-flex; align-items:center; justify-content:center; font-size:16px; line-height:1;">
        <span>🔔</span>
        <span id="badge-campanita-inferior-vea"
          style="display:none; position:absolute; top:-6px; right:-8px; min-width:17px; height:17px; padding:0 4px; border-radius:999px; background:#dc2626; color:#ffffff; font-size:10px; font-weight:700; line-height:17px; text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.4);">0</span>
      </span>
      <span style="font-size:11px; font-weight:600; color:#f4f7f5; line-height:1;">Avisos</span>
    </button>
    <div id="bandeja-campanita-inferior-vea"
      style="display:none; position:fixed; top:56px; right:14px; left:auto; width:min(360px, calc(100vw - 28px)); max-height:320px; overflow-y:auto; background:#ffffff; border:1px solid #d4af37; border-radius:10px; padding:10px; box-shadow:0 8px 24px rgba(0,0,0,0.25); z-index:1301;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e5e7eb; padding-bottom:8px; margin-bottom:8px;">
        <strong style="font-size:13px; color:#0f2e22;">Notificaciones</strong>
        <button id="btn-limpiar-no-leidas-vea" type="button"
          style="background:none; border:none; color:#0f2e22; font-size:11px; font-weight:700; cursor:pointer; text-decoration:underline;">
          Marcar leídas
        </button>
      </div>
      <div id="lista-campanita-inferior-vea" style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
        <p style="margin:0; color:#6b7280;">No tenés notificaciones nuevas.</p>
      </div>
    </div>
  `;

  insertarAlLadoDeInicioVEA(null, item);


    const btn = item.querySelector("#btn-campanita-inferior-vea");
    const bandeja = item.querySelector("#bandeja-campanita-inferior-vea");
    const btnLeidas = item.querySelector("#btn-limpiar-no-leidas-vea");

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const usuarioLogueado = Boolean(typeof auth !== "undefined" && auth.currentUser);
      if (!usuarioLogueado) {
        bandeja.style.display = "none";
        item.style.display = "none";
        return;
      }
      bandeja.style.display = bandeja.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (!item.contains(e.target)) {
        bandeja.style.display = "none";
      }
    });

    btnLeidas.addEventListener("click", async () => {
      estadoNotificacionesBarraVEA = estadoNotificacionesBarraVEA.map((n) => ({ ...n, leida: true }));
      actualizarBadgeYListaCampanitaVEA();

      if (typeof db !== "undefined" && typeof auth !== "undefined" && auth.currentUser) {
        const snap = await db
          .collection("usuarios")
          .doc(auth.currentUser.uid)
          .collection("notificaciones")
          .where("leida", "==", false)
          .get();
        if (!snap.empty) {
          const batch = db.batch();
          snap.forEach((doc) => batch.update(doc.ref, { leida: true }));
          await batch.commit();
        }
      }
    });
  }

  actualizarVisibilidadSesionCampanitaVEA();


function actualizarVisibilidadSesionCampanitaVEA(usuarioOverride = undefined) {
  const item = document.querySelector("#item-campanita-inferior-vea");
  const bandeja = document.querySelector("#bandeja-campanita-inferior-vea");
  if (!item) return;

  const usuario =
    usuarioOverride !== undefined
      ? usuarioOverride
      : typeof auth !== "undefined" && auth.currentUser
        ? auth.currentUser
        : null;

  if (!usuario) {
    item.style.display = "none";
    if (bandeja) bandeja.style.display = "none";
    estadoNotificacionesBarraVEA = [];
    actualizarBadgeYListaCampanitaVEA();
    return;
  }

  item.style.display = "inline-flex";
  cargarNotificacionesBarraVEA(usuario.uid);
}

function actualizarBadgeYListaCampanitaVEA(lista = estadoNotificacionesBarraVEA) {
  estadoNotificacionesBarraVEA = Array.isArray(lista) ? lista : [];
  const badge = document.querySelector("#badge-campanita-inferior-vea");
  const listaEl = document.querySelector("#lista-campanita-inferior-vea");
  if (!badge || !listaEl) return;

  const sinLeer = estadoNotificacionesBarraVEA.filter((n) => !n.leida).length;
  if (sinLeer > 0) {
    badge.textContent = sinLeer > 99 ? "99+" : String(sinLeer);
    badge.style.display = "inline-block";
  } else {
    badge.textContent = "0";
    badge.style.display = "none";
  }

  if (!estadoNotificacionesBarraVEA.length) {
    listaEl.innerHTML = `<p style="margin:0; color:#6b7280;">No tenés notificaciones nuevas.</p>`;
    return;
  }

  listaEl.innerHTML = estadoNotificacionesBarraVEA
    .map(
      (n, i) => `
      <div data-idx-notif="${i}"
        style="padding:8px 10px; border-radius:8px; background:${n.leida ? "#f9fafb" : "#ecfdf5"}; border:1px solid ${n.leida ? "#e5e7eb" : "#10b981"}; cursor:pointer;">
        <div style="font-weight:${n.leida ? "600" : "700"}; color:#0f2e22; margin-bottom:2px;">
          ${n.titulo || "Aviso"} ${!n.leida ? '<span style="color:#dc2626;">●</span>' : ""}
        </div>
        <div style="color:#374151; font-size:12px; line-height:1.35;">${n.mensaje || ""}</div>
      </div>`
    )
    .join("");

  listaEl.querySelectorAll("[data-idx-notif]").forEach((card) => {
    card.addEventListener("click", async () => {
      const idx = Number(card.getAttribute("data-idx-notif"));
      const notif = estadoNotificacionesBarraVEA[idx];
      if (!notif) return;
      notif.leida = true;
      actualizarBadgeYListaCampanitaVEA();

      if (notif.id && typeof db !== "undefined" && typeof auth !== "undefined" && auth.currentUser) {
        await db
          .collection("usuarios")
          .doc(auth.currentUser.uid)
          .collection("notificaciones")
          .doc(notif.id)
          .set({ leida: true }, { merge: true });
      }
    });
  });
}

async function cargarNotificacionesBarraVEA(uid) {
  if (!uid || typeof db === "undefined") {
    actualizarBadgeYListaCampanitaVEA([]);
    return;
  }
  try {
    const snap = await db
      .collection("usuarios")
      .doc(uid)
      .collection("notificaciones")
      .orderBy("fechaCreacion", "desc")
      .limit(20)
      .get();

    const docs = [];
    snap.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));
    actualizarBadgeYListaCampanitaVEA(docs);
  } catch (err) {
    console.error("Error cargando notificaciones de barra:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarCampanitaBarraInferiorVEA();
  if (typeof auth !== "undefined" && typeof auth.onAuthStateChanged === "function") {
    auth.onAuthStateChanged((user) => {
      actualizarVisibilidadSesionCampanitaVEA(user || null);
    });
  }
});