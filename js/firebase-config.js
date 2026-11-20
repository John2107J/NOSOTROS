/**
 * Configuración de Firebase.
 *
 * Reemplazá este objeto por el que te da la consola de Firebase en
 * Configuración del proyecto → General → Tus apps → (app web) → "SDK setup and configuration".
 * Ver FIREBASE_SETUP.md para el paso a paso.
 *
 * Estos valores NO son secretos: identifican tu proyecto. La seguridad real
 * la dan las reglas de firestore.rules.
 */
export const firebaseConfig = {
  apiKey:            'PEGAR_AQUI',
  authDomain:        'PEGAR_AQUI.firebaseapp.com',
  projectId:         'PEGAR_AQUI',
  storageBucket:     'PEGAR_AQUI.appspot.com',
  messagingSenderId: 'PEGAR_AQUI',
  appId:             'PEGAR_AQUI',
};

export const firebaseConfigurado = !firebaseConfig.apiKey.startsWith('PEGAR');
