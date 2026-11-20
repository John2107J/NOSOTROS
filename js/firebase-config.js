/**
 * Configuración de Firebase (proyecto nosotros-2107).
 *
 * Estos valores NO son secretos: identifican el proyecto y el navegador
 * siempre los recibe. La seguridad la dan las reglas de firestore.rules,
 * los dominios autorizados de Authentication y la restricción de la API key.
 * Ver FIREBASE_SETUP.md.
 */
export const firebaseConfig = {
  apiKey:            'AIzaSyA4MGy0fT10azwG7mRdAO2NmCW1vxpVqbk',
  authDomain:        'nosotros-2107.firebaseapp.com',
  projectId:         'nosotros-2107',
  storageBucket:     'nosotros-2107.firebasestorage.app',
  messagingSenderId: '878268543439',
  appId:             '1:878268543439:web:0551ef626ffeeb45a762ba',
};

export const firebaseConfigurado = !firebaseConfig.apiKey.startsWith('PEGAR');
