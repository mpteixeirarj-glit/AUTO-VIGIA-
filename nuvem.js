/* Auto-Vigia — acesso ao Firebase (projeto exclusivo "auto-vigia"), carregado sob demanda.
 *
 * Login OPCIONAL com Google. Sem rede ou sem login, o app segue 100% local (IndexedDB):
 * este módulo nunca bloqueia a abertura do app.
 *
 * Dados em usuarios/{uid}/autovigia/dados → { v, json, atualizadoEm }, onde json é o
 * texto de { vehicle, maintenances, apagados } (em texto para não depender dos tipos do Firestore).
 * Regra necessária no Firestore (Console → Firestore → Regras):
 *   match /usuarios/{uid}/autovigia/{doc} {
 *     allow read, write: if request.auth != null && request.auth.uid == uid;
 *   }
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Config pública do projeto (não é segredo: o acesso é controlado pelas regras do Firestore).
const firebaseConfig = {
  apiKey: 'AIzaSyDTEkTH5KUCg64zWlSMrfxHMbKYThP5_s8',
  authDomain: 'auto-vigia.firebaseapp.com',
  projectId: 'auto-vigia',
  storageBucket: 'auto-vigia.firebasestorage.app',
  messagingSenderId: '894674432637',
  appId: '1:894674432637:web:0d4d53688c182a440af714'
};

// App com nome próprio: a sessão fica numa chave só do Auto-Vigia (mesma origem dos outros Vigias).
const app = initializeApp(firebaseConfig, 'auto-vigia');
const auth = getAuth(app);
const db = getFirestore(app);

let pronto = null;
/** Usuário restaurado da sessão salva neste aparelho (ou null). */
export function usuarioAtual() {
  if (!pronto) pronto = new Promise((res) => { const off = onAuthStateChanged(auth, () => { off(); res(); }); });
  return pronto.then(() => auth.currentUser);
}

const MSG = {
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/cancelled-popup-request': 'Login cancelado.',
  'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere pop-ups para este site e tente de novo.',
  'auth/operation-not-supported-in-this-environment': 'O login com Google não abre neste modo. Abra o Vigia Auto pelo navegador e entre por lá.',
  'auth/network-request-failed': 'Sem conexão. Tente novamente.',
  'auth/unauthorized-domain': 'Domínio não autorizado no Firebase (Authentication → Settings → Authorized domains).',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'permission-denied': 'A nuvem recusou o acesso: publique as regras do Firestore (veja o README).'
};
export function mensagem(e) { return MSG[e && e.code] || (e && e.message) || 'Erro desconhecido.'; }

export async function entrarGoogle() {
  const prov = new GoogleAuthProvider();
  prov.setCustomParameters({ prompt: 'select_account' });
  return (await signInWithPopup(auth, prov)).user;
}
export function sair() { return signOut(auth); }

function ref(uid) { return doc(db, 'usuarios', uid, 'autovigia', 'dados'); }
/** Texto JSON guardado na nuvem, ou null se ainda não há nada. */
export async function baixar(uid) {
  const s = await getDoc(ref(uid));
  return s.exists() ? (s.data().json || null) : null;
}
export function gravar(uid, json) {
  return setDoc(ref(uid), { v: 1, json, atualizadoEm: serverTimestamp() });
}
