# Configurar Firebase para Corazoncitos (una sola vez, ~10 minutos)

La sección Corazoncitos (antes Porotitos; el nombre se puede cambiar) guarda los datos en una base compartida (Firebase, de Google, gratis para este uso)
para que los dos celulares vean lo mismo en tiempo real.

## 1. Crear el proyecto
1. Entrá a https://console.firebase.google.com con tu cuenta de Google.
2. **Agregar proyecto** → nombre: `nosotros` → podés desactivar Google Analytics → **Crear**.

## 2. Activar el login con Google
1. Menú izquierdo: **Compilación → Authentication → Comenzar**.
2. Pestaña **Método de acceso** → **Google** → **Habilitar** → elegí tu email de soporte → **Guardar**.
3. Pestaña **Configuración → Dominios autorizados → Agregar dominio** y poné el dominio donde
   está publicada la app (por ejemplo `john2107j.github.io`). `localhost` ya viene incluido.

## 3. Crear la base de datos
1. Menú izquierdo: **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: `southamerica-east1 (São Paulo)` (la más cercana a Argentina).
3. Elegí **Iniciar en modo de producción** → **Crear**.

## 4. Pegar las reglas de seguridad (¡importante!)
1. En Firestore, pestaña **Reglas**.
2. Borrá todo lo que hay y pegá el contenido completo del archivo `firestore.rules` de este repo.
3. **Publicar**.

Estas reglas son las que impiden que alguien se sume puntos a sí mismo, canjee un premio
que no es para él/ella o canjee sin saldo, aunque intente hacerlo "por fuera" de la app.

## 5. Conectar la app
1. Arriba a la izquierda, el engranaje ⚙️ → **Configuración del proyecto**.
2. Abajo, en **Tus apps**, tocá el ícono web `</>` → apodo `nosotros` → **Registrar app**
   (no hace falta Firebase Hosting).
3. Te muestra un bloque `const firebaseConfig = { ... }`. Copiá esos valores en
   `js/firebase-config.js`, reemplazando los `PEGAR_AQUI`.
4. Subí los cambios a GitHub.

> Estos valores no son secretos (cualquier app web de Firebase los expone); la protección real
> son las reglas del paso 4.

## 6. Usarla
1. Uno de los dos entra a **Corazoncitos → Entrar con Google → Crear nuestro espacio**.
2. Comparte el código de 6 letras.
3. El otro entra con su cuenta de Google → **Tengo un código** → lo pega → **Unirme**.

## Notas
- **iPhone con la app agregada a la pantalla de inicio:** en algunos iPhone el login de Google no
  abre desde la app instalada. Si les pasa, avisame y agregamos login por email.
- **Probar las reglas sin tocar datos reales:** en Firestore → Reglas → **Playground de reglas**.
- El plan gratuito (Spark) alcanza de sobra para dos personas.
