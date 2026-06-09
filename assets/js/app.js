import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDO6Cz65ejgCEDEVXzdeM-JFrQ69UQgBNg",
  authDomain: "orcamento-dmais.firebaseapp.com",
  projectId: "orcamento-dmais",
  storageBucket: "orcamento-dmais.firebasestorage.app",
  messagingSenderId: "927295167091",
  appId: "1:927295167091:web:dbb31be5a35012bfa4e806"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const STORAGE_ITEMS = "dmais_orcamento_itens_v3_zerado";
const STORAGE_FIELDS = "dmais_orcamento_campos_v3_zerado";
const FIELD_IDS = [
  "empresaNome", "empresaRazao", "empresaCnpj", "empresaIe", "empresaCidade",
  "empresaTelefone", "empresaEndereco", "clienteNome", "clienteEndereco",
  "pagamento", "validade", "entrega", "observacaoGeral"
];

let currentUser = null;
let produtos = [];
let itens = [];
let historico = [];
let draggedItemId = null;
let editingItemId = null;
let loadedQuoteId = null;
let isBootingUser = false;

const $ = (id) => document.getElementById(id);

function toMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function onlyNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeSearch(value) {
  return normalizeText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function newId(prefix = "id") {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function userLocalKey(base) {
  return `${base}_${currentUser?.uid || "sem_usuario"}`;
}

function setStatus(message, type = "info") {
  const el = $("syncStatus");
  if (!el) return;
  el.textContent = message || "";
  el.className = `sync-status ${type}`;
}

function setAuthMessage(message, type = "info") {
  const el = $("authMsg");
  if (!el) return;
  el.textContent = message || "";
  el.className = `auth-msg ${type}`;
}

function friendlyFirebaseError(error) {
  const code = error?.code || "";
  const map = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/missing-password": "Informe a senha.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/email-already-in-use": "Esse e-mail já tem uma conta cadastrada.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "permission-denied": "Sem permissão no banco. Confira as regras do Firestore."
  };
  return map[code] || error?.message || "Ocorreu um erro.";
}

function produtosCol() {
  return collection(db, "usuarios", currentUser.uid, "produtos");
}

function orcamentosCol() {
  return collection(db, "usuarios", currentUser.uid, "orcamentos");
}

function getProduct(id) {
  return produtos.find((p) => p.id === id);
}

function getFieldsObject() {
  const fields = {};
  FIELD_IDS.forEach((id) => fields[id] = $(id)?.value || "");
  return fields;
}

function applyFields(fields = {}) {
  FIELD_IDS.forEach((id) => {
    if ($(id) && fields[id] !== undefined) $(id).value = fields[id] || "";
  });
}

function calculateTotal(items = itens) {
  return items.reduce((sum, item) => sum + onlyNumber(item.quantidade) * onlyNumber(item.preco), 0);
}

function hydrateItem(item) {
  const product = getProduct(item.produtoId);
  return {
    ...item,
    id: item.id || newId("item"),
    nome: item.nome || product?.nome || "PRODUTO REMOVIDO",
    unidade: item.unidade || product?.unidade || "UND",
    imagem: item.imagem || product?.imagem || "assets/img/sem_imagem.svg",
    preco: onlyNumber(item.preco ?? product?.preco)
  };
}

function saveDraftLocal() {
  if (!currentUser || isBootingUser) return;
  localStorage.setItem(userLocalKey(STORAGE_ITEMS), JSON.stringify(itens));
  localStorage.setItem(userLocalKey(STORAGE_FIELDS), JSON.stringify(getFieldsObject()));
}

function loadDraftLocal() {
  try {
    const savedItems = JSON.parse(localStorage.getItem(userLocalKey(STORAGE_ITEMS)) || "[]");
    itens = Array.isArray(savedItems) ? savedItems.map(hydrateItem) : [];
  } catch {
    itens = [];
  }

  try {
    const fields = JSON.parse(localStorage.getItem(userLocalKey(STORAGE_FIELDS)) || "{}");
    applyFields(fields);
  } catch {}
}

async function loadProductsFromFirestore() {
  const snap = await getDocs(query(produtosCol(), orderBy("nome")));

  // Versão zerada: não cria produtos de exemplo automaticamente.
  // Cada conta começa vazia e o cliente cadastra os próprios equipamentos.
  produtos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadHistory() {
  if (!currentUser) return;
  const snap = await getDocs(query(orcamentosCol(), orderBy("criadoEm", "desc"), limit(30)));
  historico = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderHistory();
}

async function trimHistoryTo30() {
  const snap = await getDocs(query(orcamentosCol(), orderBy("criadoEm", "desc"), limit(40)));
  const extras = snap.docs.slice(30);
  await Promise.all(extras.map((d) => deleteDoc(doc(orcamentosCol(), d.id))));
}

async function saveQuoteToHistory() {
  if (!currentUser) return alert("Faça login para salvar.");
  if (!itens.length) return alert("Adicione pelo menos um item antes de salvar.");

  try {
    setStatus("Salvando orçamento...", "info");
    const payload = {
      campos: getFieldsObject(),
      itens: itens.map(hydrateItem),
      totalGeral: calculateTotal(),
      clienteNome: $("clienteNome").value || "SEM CLIENTE",
      atualizadoEm: serverTimestamp()
    };

    if (loadedQuoteId) {
      await setDoc(doc(orcamentosCol(), loadedQuoteId), payload, { merge: true });
    } else {
      const ref = await addDoc(orcamentosCol(), { ...payload, criadoEm: serverTimestamp() });
      loadedQuoteId = ref.id;
    }

    await trimHistoryTo30();
    await loadHistory();
    saveDraftLocal();
    setStatus("Orçamento salvo no histórico.", "success");
  } catch (error) {
    console.error(error);
    setStatus(friendlyFirebaseError(error), "error");
    alert(friendlyFirebaseError(error));
  }
}

function openQuote(id) {
  const quote = historico.find((q) => q.id === id);
  if (!quote) return;
  loadedQuoteId = quote.id;
  itens = Array.isArray(quote.itens) ? quote.itens.map(hydrateItem) : [];
  applyFields(quote.campos || {});
  saveDraftLocal();
  renderAll();
  setStatus("Orçamento carregado do histórico.", "success");
}

function duplicateQuote(id) {
  const quote = historico.find((q) => q.id === id);
  if (!quote) return;
  loadedQuoteId = null;
  itens = Array.isArray(quote.itens) ? quote.itens.map((item) => ({ ...hydrateItem(item), id: newId("item") })) : [];
  applyFields(quote.campos || {});
  saveDraftLocal();
  renderAll();
  setStatus("Cópia carregada. Clique em salvar para gravar como novo orçamento.", "info");
}

async function removeQuote(id) {
  if (!confirm("Deseja excluir este orçamento do histórico?")) return;
  try {
    await deleteDoc(doc(orcamentosCol(), id));
    if (loadedQuoteId === id) loadedQuoteId = null;
    await loadHistory();
    setStatus("Orçamento excluído.", "success");
  } catch (error) {
    console.error(error);
    setStatus(friendlyFirebaseError(error), "error");
  }
}

function formatDateFromFirestore(value) {
  if (!value) return "Sem data";
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function renderHistory() {
  const box = $("historicoLista");
  if (!box) return;

  if (!historico.length) {
    box.innerHTML = `<div class="history-empty">Nenhum orçamento salvo ainda.</div>`;
    return;
  }

  box.innerHTML = historico.map((q) => `
    <div class="history-card ${loadedQuoteId === q.id ? "active" : ""}">
      <div>
        <strong>${escapeHtml(q.clienteNome || "SEM CLIENTE")}</strong>
        <span>${formatDateFromFirestore(q.criadoEm)} • ${toMoney(q.totalGeral)}</span>
      </div>
      <div class="history-actions">
        <button class="btn-secondary btn-small" onclick="openQuote('${q.id}')">Abrir</button>
        <button class="btn-outline btn-small" onclick="duplicateQuote('${q.id}')">Duplicar</button>
        <button class="btn-danger btn-small" onclick="removeQuote('${q.id}')">×</button>
      </div>
    </div>
  `).join("");
}

function getSearchResults(term, limitCount = 12) {
  const normalizedTerm = normalizeSearch(term);
  if (!normalizedTerm) return produtos.slice(0, limitCount);

  const words = normalizedTerm.split(/\s+/).filter(Boolean);
  return produtos
    .filter((p) => {
      const productText = normalizeSearch(`${p.nome} ${p.unidade} ${p.preco}`);
      return words.every((word) => productText.includes(word));
    })
    .slice(0, limitCount);
}

function renderProductOptions() {
  const selected = getProduct($("produtoSelect").value) || produtos[0];
  if (selected) {
    selectProduct(selected.id, false);
  } else {
    $("produtoBusca").value = "";
    $("produtoSelect").value = "";
    updateSelectedProduct();
  }
}

function renderProductSuggestions(term) {
  const box = $("produtoSugestoes");
  const results = getSearchResults(term, 12);

  if (!results.length) {
    box.innerHTML = `<div class="suggestion-empty">Nenhum equipamento encontrado.</div>`;
    box.classList.add("show");
    return;
  }

  box.innerHTML = results.map((p) => `
    <button type="button" class="suggestion-item" data-product-id="${escapeHtml(p.id)}">
      <img src="${p.imagem}" alt="${escapeHtml(p.nome)}" />
      <span>
        <strong>${escapeHtml(p.nome)}</strong>
        <small>${escapeHtml(p.unidade)} • ${toMoney(p.preco)}</small>
      </span>
    </button>
  `).join("");

  box.classList.add("show");
  box.querySelectorAll(".suggestion-item").forEach((button) => {
    button.addEventListener("click", () => selectProduct(button.dataset.productId));
  });
}

function hideProductSuggestions() {
  $("produtoSugestoes").classList.remove("show");
}

function selectProduct(id, hideSuggestions = true) {
  const product = getProduct(id);
  if (!product) return;

  $("produtoSelect").value = product.id;
  $("produtoBusca").value = `${product.nome} - ${toMoney(product.preco)}`;
  $("precoUnitario").value = Number(product.preco).toFixed(2);

  if (hideSuggestions) hideProductSuggestions();
  updateSelectedProduct();
}

function updateSelectedProduct() {
  const product = getProduct($("produtoSelect").value);

  if (!product) {
    $("produtoSelecionado").innerHTML = `
      <div>
        <strong>Nenhum equipamento selecionado</strong>
        <span>Digite no campo acima e escolha um item da lista.</span>
      </div>
    `;
    const deleteButton = $("excluirEquipamentoSelecionado");
    if (deleteButton) deleteButton.disabled = true;
    return;
  }

  $("produtoSelecionado").innerHTML = `
    <img src="${product.imagem}" alt="${escapeHtml(product.nome)}" />
    <div class="selected-product-info">
      <strong>${escapeHtml(product.nome)}</strong>
      <span>Unidade: ${escapeHtml(product.unidade)} | Preço padrão: ${toMoney(product.preco)}</span>
    </div>
  `;

  const deleteButton = $("excluirEquipamentoSelecionado");
  if (deleteButton) deleteButton.disabled = false;
}

async function deleteSelectedProduct() {
  if (!currentUser) return alert("Faça login para excluir equipamento.");

  const product = getProduct($("produtoSelect").value);
  if (!product) return alert("Selecione um equipamento para excluir.");

  const usedCount = itens.filter((item) => item.produtoId === product.id).length;
  const usedWarning = usedCount
    ? `\n\nEsse equipamento aparece em ${usedCount} item(ns) do orçamento atual. A exclusão remove o equipamento do cadastro, mas não apaga os itens já adicionados neste orçamento.`
    : "";

  const confirmed = confirm(
    `Deseja excluir definitivamente este equipamento do cadastro?\n\n${product.nome}${usedWarning}\n\nDepois de excluir, ele não será recriado automaticamente ao fazer login.`
  );
  if (!confirmed) return;

  try {
    setStatus("Excluindo equipamento do Firebase...", "info");
    await deleteDoc(doc(produtosCol(), product.id));

    produtos = produtos.filter((p) => p.id !== product.id);
    $("produtoBusca").value = "";
    $("produtoSelect").value = "";
    $("precoUnitario").value = "0.00";
    hideProductSuggestions();
    updateSelectedProduct();

    renderAll();
    setStatus("Equipamento excluído definitivamente do cadastro.", "success");
  } catch (error) {
    console.error(error);
    setStatus(friendlyFirebaseError(error), "error");
    alert(friendlyFirebaseError(error));
  }
}

function makeFilename() {
  const cliente = normalizeText($("clienteNome").value || "cliente").replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  return `orcamento_${cliente || "cliente"}_${date}`;
}

function downloadWord() {
  const content = $("quotePage").outerHTML;
  const styles = `
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; }
    .quote-page { width: 760px; margin: 0 auto; }
    .report-page { padding: 28px 30px; border-bottom: 1px solid #ddd; page-break-after: always; }
    .report-page:last-child { page-break-after: auto; }
    .report-topbar { display: table; width: 100%; border-bottom: 1px solid #dfe9e3; padding-bottom: 14px; margin-bottom: 20px; }
    .report-brand, .report-company-info, .report-meta { display: table-cell; vertical-align: top; }
    .report-brand { width: 230px; }
    .report-brand img, .report-page-header img { width: 80px; height: auto; }
    .report-label, .report-eyebrow, .report-section-title span, .report-page-header span, .closing-box > span { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #167a3a; }
    .report-brand h2, .report-section-title h2, .report-page-header h2, .closing-box h2 { margin: 5px 0; color: #0f5f2c; }
    .report-company-info, .report-meta, .info-card small, .closing-note, .closing-observations p { font-size: 11px; color: #4b5d52; line-height: 1.4; }
    .closing-observations { border: 1px solid #dfe9e3; padding: 12px; border-radius: 8px; margin-top: 14px; }
    .closing-observations span { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #167a3a; }
    .closing-observations p { white-space: pre-line; margin: 8px 0 0; }
    .hidden-print-block { display: none; }
    .page-number { text-align: right; font-size: 10px; color: #6b7280; margin-top: 18px; }
    .report-hero { margin: 24px 0; }
    .report-hero h1 { font-size: 28px; margin: 6px 0 10px; color: #102319; }
    .hero-total-card, .closing-total { background: #0f5f2c; color: #fff; padding: 16px; border-radius: 10px; margin: 14px 0; }
    .hero-total-card strong, .closing-total strong { display: block; font-size: 24px; margin-top: 5px; }
    .report-info-grid, .environment-summary, .closing-conditions { display: table; width: 100%; border-spacing: 8px; }
    .info-card, .summary-card, .closing-conditions div { display: table-cell; border: 1px solid #dfe9e3; padding: 10px; border-radius: 8px; }
    .info-card strong, .summary-card strong, .closing-conditions strong { display: block; margin-top: 5px; color: #12251a; }
    .environment-card { border: 1px solid #dfe9e3; margin-bottom: 14px; page-break-inside: avoid; }
    .environment-card-head { background: #f2f8f4; padding: 10px; border-bottom: 1px solid #dfe9e3; }
    .environment-card-head h3 { margin: 3px 0; color: #102319; }
    .premium-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .premium-table th { background: #f7faf8; color: #425348; text-align: left; font-size: 10px; text-transform: uppercase; }
    .premium-table th, .premium-table td { border-bottom: 1px solid #edf2ef; padding: 7px; vertical-align: middle; }
    .premium-table img { width: 55px; max-height: 45px; object-fit: contain; }
    .col-qty, .col-unit { text-align: center; }
    .col-price, .col-total { text-align: right; white-space: nowrap; }
    .col-total { font-weight: bold; }
  `;
  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Orçamento</title><style>${styles}</style></head>
    <body>${content}</body></html>
  `;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${makeFilename()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function login() {
  const email = $("authEmail").value.trim();
  const senha = $("authSenha").value;
  if (!email || !senha) return setAuthMessage("Informe e-mail e senha.", "error");

  try {
    setAuthMessage("Entrando...", "info");
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (error) {
    console.error(error);
    setAuthMessage(friendlyFirebaseError(error), "error");
  }
}

async function createAccount() {
  const email = $("authEmail").value.trim();
  const senha = $("authSenha").value;
  if (!email || !senha) return setAuthMessage("Informe e-mail e senha.", "error");

  try {
    setAuthMessage("Criando conta...", "info");
    await createUserWithEmailAndPassword(auth, email, senha);
  } catch (error) {
    console.error(error);
    setAuthMessage(friendlyFirebaseError(error), "error");
  }
}

async function resetPassword() {
  const email = $("authEmail").value.trim();
  if (!email) return setAuthMessage("Informe o e-mail para recuperar a senha.", "error");

  try {
    await sendPasswordResetEmail(auth, email);
    setAuthMessage("Link de redefinição enviado para o e-mail.", "success");
  } catch (error) {
    console.error(error);
    setAuthMessage(friendlyFirebaseError(error), "error");
  }
}

async function logout() {
  await signOut(auth);
}

function bindEvents() {
  $("loginBtn").addEventListener("click", login);
  $("criarContaBtn").addEventListener("click", createAccount);
  $("resetSenhaBtn").addEventListener("click", resetPassword);
  $("authSenha").addEventListener("keydown", (event) => { if (event.key === "Enter") login(); });
  $("logoutBtn").addEventListener("click", logout);

  $("produtoBusca").addEventListener("input", (event) => {
    $("produtoSelect").value = "";
    renderProductSuggestions(event.target.value);
    updateSelectedProduct();
  });

  $("produtoBusca").addEventListener("focus", () => renderProductSuggestions($("produtoBusca").value));
  $("produtoBusca").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const firstOption = $("produtoSugestoes").querySelector(".suggestion-item");
    if (firstOption) {
      event.preventDefault();
      selectProduct(firstOption.dataset.productId);
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".product-search-wrap")) hideProductSuggestions();
  });

  $("adicionarItem").addEventListener("click", addItem);
  $("limparOrcamento").addEventListener("click", clearQuote);
  $("excluirEquipamentoSelecionado").addEventListener("click", deleteSelectedProduct);
  $("salvarProduto").addEventListener("click", saveProduct);
  $("imprimirPdf").addEventListener("click", printQuote);
  $("baixarWord").addEventListener("click", downloadWord);
  $("salvarHistorico").addEventListener("click", saveQuoteToHistory);
  $("salvarHistoricoTop").addEventListener("click", saveQuoteToHistory);
  $("novoOrcamento").addEventListener("click", newQuote);
  $("recarregarHistorico").addEventListener("click", loadHistory);

  FIELD_IDS.forEach((id) => {
    $(id).addEventListener("input", () => {
      loadedQuoteId = null;
      saveDraftLocal();
      renderQuote();
    });
  });
}

async function bootUser(user) {
  currentUser = user;
  isBootingUser = true;
  $("authScreen").classList.add("hidden");
  $("appShell").classList.remove("hidden");
  $("userEmail").textContent = user.email || "usuário";
  setStatus("Carregando dados da conta...", "info");

  try {
    await loadProductsFromFirestore();
    loadDraftLocal();
    renderProductOptions();

    await loadHistory();
    renderAll();
    setStatus("Sistema pronto.", "success");
  } catch (error) {
    console.error(error);
    setStatus(friendlyFirebaseError(error), "error");
    alert(friendlyFirebaseError(error));
  } finally {
    isBootingUser = false;
  }
}

function showAuthScreen() {
  currentUser = null;
  produtos = [];
  itens = [];
  historico = [];
  loadedQuoteId = null;
  $("authScreen").classList.remove("hidden");
  $("appShell").classList.add("hidden");
  setAuthMessage("", "info");
}

window.deleteItem = deleteItem;
window.startEditItem = startEditItem;
window.cancelEditItem = cancelEditItem;
window.saveEditItem = saveEditItem;
window.deleteSelectedProduct = deleteSelectedProduct;
window.openQuote = openQuote;
window.duplicateQuote = duplicateQuote;
window.removeQuote = removeQuote;

bindEvents();

onAuthStateChanged(auth, async (user) => {
  if (user) await bootUser(user);
  else showAuthScreen();
});
