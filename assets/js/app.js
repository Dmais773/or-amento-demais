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
  apiKey: "AIzaSyBTjRaD-XcSggXD0LHz3h8rz7zzO6icjZs",
  authDomain: "dmais-orcamento.firebaseapp.com",
  projectId: "dmais-orcamento",
  storageBucket: "dmais-orcamento.firebasestorage.app",
  messagingSenderId: "354160490922",
  appId: "1:354160490922:web:d49ae00fd3ba65465353d3"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const DEFAULT_PRODUCTS = [
  { id: "p1", nome: "SPOT DUPLO PAR20 PRETO", unidade: "UM", preco: 84.00, imagem: "assets/img/spot_duplo_preto.svg" },
  { id: "p2", nome: "LÂMPADA LED PAR20 3000K 7W IRC95", unidade: "UM", preco: 27.90, imagem: "assets/img/lampada_par20.svg" },
  { id: "p3", nome: "SPOT SOBREPOR PAR20", unidade: "UM", preco: 169.90, imagem: "assets/img/spot_sobrepor_par20.svg" },
  { id: "p4", nome: "SPOT MR16 PRETO", unidade: "UM", preco: 25.90, imagem: "assets/img/spot_mr16_preto.svg" },
  { id: "p5", nome: "LÂMPADA LED MR16 3000K 7W IRC95", unidade: "UM", preco: 22.90, imagem: "assets/img/lampada_mr16.svg" },
  { id: "p6", nome: "PENDENTE TUBOLARE MR16 53MM X H295MM CILÍNDRICO", unidade: "UND", preco: 269.90, imagem: "assets/img/pendente_tubolare.svg" },
  { id: "p7", nome: "PAINEL LED FRAMELESS 24W 3000K REDONDO", unidade: "UND", preco: 69.00, imagem: "assets/img/painel_led_redondo.svg" },
  { id: "p8", nome: "PLAFON CÚPULA DUPLA LINHO 50X16 4 SOQUETES E-27", unidade: "UND", preco: 879.00, imagem: "assets/img/plafon_linho.svg" },
  { id: "p9", nome: "FITA LED IP20 20W 3000K 12V 240L/M", unidade: "MTS", preco: 39.90, imagem: "assets/img/fita_led.svg" },
  { id: "p10", nome: "FONTE DC 12V SLIM 4A/72W BIVOLT", unidade: "UND", preco: 69.90, imagem: "assets/img/fonte_dc.svg" }
];

const DEFAULT_ITEMS = [
  { ambiente: "GARAGEM", produtoId: "p1", quantidade: 6, preco: 84.00 },
  { ambiente: "GARAGEM", produtoId: "p2", quantidade: 12, preco: 27.90 },
  { ambiente: "BEIRA FACHADA", produtoId: "p3", quantidade: 6, preco: 169.90 },
  { ambiente: "BEIRA FACHADA", produtoId: "p2", quantidade: 6, preco: 27.90 },
  { ambiente: "SALA", produtoId: "p4", quantidade: 5, preco: 25.90 },
  { ambiente: "SALA", produtoId: "p5", quantidade: 5, preco: 22.90 },
  { ambiente: "COZINHA", produtoId: "p6", quantidade: 2, preco: 269.90 },
  { ambiente: "COZINHA", produtoId: "p5", quantidade: 2, preco: 22.90 },
  { ambiente: "QUARTO E LAVANDERIA", produtoId: "p7", quantidade: 3, preco: 69.00 },
  { ambiente: "SUÍTE", produtoId: "p8", quantidade: 1, preco: 879.00 },
  { ambiente: "SALA - SUÍTE E QUARTOS", produtoId: "p9", quantidade: 8, preco: 39.90 },
  { ambiente: "SALA - SUÍTE E QUARTOS", produtoId: "p10", quantidade: 1, preco: 69.90 }
];

const STORAGE_ITEMS = "dmais_orcamento_itens_v2";
const STORAGE_FIELDS = "dmais_orcamento_campos_v2";
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
    imagem: item.imagem || product?.imagem || "assets/img/spot_duplo_preto.svg",
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

  if (snap.empty) {
    await Promise.all(DEFAULT_PRODUCTS.map((p) => setDoc(doc(produtosCol(), p.id), {
      ...p,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    })));
    produtos = [...DEFAULT_PRODUCTS];
    return;
  }

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
    ? `\n\nEsse equipamento aparece em ${usedCount} item(ns) do orçamento atual. A exclusão remove o equipamento do cadastro, mas não apaga os itens já adicionados no orçamento.`
    : "";

  const confirmed = confirm(`Deseja realmente excluir o equipamento:\n\n${product.nome}?${usedWarning}`);
  if (!confirmed) return;

  try {
    setStatus("Excluindo equipamento...", "info");
    await deleteDoc(doc(produtosCol(), product.id));

    produtos = produtos.filter((p) => p.id !== product.id);
    hideProductSuggestions();

    if (produtos.length) {
      selectProduct(produtos[0].id, false);
    } else {
      $("produtoBusca").value = "";
      $("produtoSelect").value = "";
      $("precoUnitario").value = "0.00";
      updateSelectedProduct();
    }

    renderAll();
    setStatus("Equipamento excluído do cadastro.", "success");
  } catch (error) {
    console.error(error);
    setStatus(friendlyFirebaseError(error), "error");
    alert(friendlyFirebaseError(error));
  }
}

function addItem() {
  const product = getProduct($("produtoSelect").value);
  if (!product) return alert("Digite e selecione um equipamento da lista antes de adicionar.");

  const ambiente = normalizeText($("ambiente").value);
  const quantidade = onlyNumber($("quantidade").value);
  const preco = onlyNumber($("precoUnitario").value);

  if (!ambiente) return alert("Informe o ambiente.");
  if (quantidade <= 0) return alert("Informe uma quantidade maior que zero.");

  itens.push({
    id: newId("item"),
    ambiente,
    produtoId: product.id,
    nome: product.nome,
    unidade: product.unidade,
    imagem: product.imagem,
    quantidade,
    preco
  });

  loadedQuoteId = null;
  saveDraftLocal();
  renderAll();
}

function deleteItem(id) {
  if (editingItemId === id) editingItemId = null;
  itens = itens.filter((item) => item.id !== id);
  loadedQuoteId = null;
  saveDraftLocal();
  renderAll();
}

function getGroupedItems() {
  const grouped = new Map();
  itens.forEach((raw) => {
    const item = hydrateItem(raw);
    if (!grouped.has(item.ambiente)) grouped.set(item.ambiente, []);
    grouped.get(item.ambiente).push(item);
  });
  return grouped;
}

function flattenGroupedItems(grouped) {
  const flattened = [];
  grouped.forEach((envItems) => envItems.forEach((item) => flattened.push(item)));
  return flattened;
}

function reorderItemInSameEnvironment(draggedId, targetId, insertAfter = false) {
  if (!draggedId || !targetId || draggedId === targetId) return;

  const grouped = getGroupedItems();
  let changed = false;

  grouped.forEach((envItems) => {
    if (changed) return;
    const draggedIndex = envItems.findIndex((item) => item.id === draggedId);
    const targetIndexOriginal = envItems.findIndex((item) => item.id === targetId);
    if (draggedIndex === -1 || targetIndexOriginal === -1) return;

    const [draggedItem] = envItems.splice(draggedIndex, 1);
    const targetIndex = envItems.findIndex((item) => item.id === targetId);
    if (targetIndex === -1) return;

    envItems.splice(insertAfter ? targetIndex + 1 : targetIndex, 0, draggedItem);
    changed = true;
  });

  if (!changed) return;
  itens = flattenGroupedItems(grouped);
  loadedQuoteId = null;
  saveDraftLocal();
  renderAll();
}

function setupDragAndDrop() {
  const lines = document.querySelectorAll(".item-line[draggable='true']");
  lines.forEach((line) => {
    line.addEventListener("dragstart", (event) => {
      draggedItemId = line.dataset.itemId;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedItemId);
      line.classList.add("dragging");
    });

    line.addEventListener("dragend", () => {
      draggedItemId = null;
      line.classList.remove("dragging");
      document.querySelectorAll(".item-line.drag-over-before, .item-line.drag-over-after")
        .forEach((el) => el.classList.remove("drag-over-before", "drag-over-after"));
    });

    line.addEventListener("dragover", (event) => {
      const draggedId = draggedItemId || event.dataTransfer.getData("text/plain");
      if (!draggedId || draggedId === line.dataset.itemId) return;
      const draggedItem = itens.find((item) => item.id === draggedId);
      if (!draggedItem || draggedItem.ambiente !== line.dataset.ambiente) return;

      event.preventDefault();
      const rect = line.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      line.classList.toggle("drag-over-before", !insertAfter);
      line.classList.toggle("drag-over-after", insertAfter);
    });

    line.addEventListener("dragleave", () => {
      line.classList.remove("drag-over-before", "drag-over-after");
    });

    line.addEventListener("drop", (event) => {
      event.preventDefault();
      const draggedId = draggedItemId || event.dataTransfer.getData("text/plain");
      const targetId = line.dataset.itemId;
      const rect = line.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      reorderItemInSameEnvironment(draggedId, targetId, insertAfter);
    });
  });
}

function startEditItem(id) {
  editingItemId = id;
  renderItemsList();
}

function cancelEditItem() {
  editingItemId = null;
  renderItemsList();
}

function makeSafeId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function saveEditItem(id) {
  const item = itens.find((item) => item.id === id);
  if (!item) return;

  const safeId = makeSafeId(id);
  const ambiente = normalizeText($("editAmbiente_" + safeId)?.value || item.ambiente);
  const quantidade = onlyNumber($("editQuantidade_" + safeId)?.value);
  const preco = onlyNumber($("editPreco_" + safeId)?.value);

  if (!ambiente) return alert("Informe o ambiente.");
  if (quantidade <= 0) return alert("Informe uma quantidade maior que zero.");
  if (preco < 0) return alert("Informe um preço válido.");

  item.ambiente = ambiente;
  item.quantidade = quantidade;
  item.preco = preco;

  editingItemId = null;
  loadedQuoteId = null;
  saveDraftLocal();
  renderAll();
}

function renderItemsList() {
  const list = $("listaItens");
  if (!itens.length) {
    list.innerHTML = `<div class="items-list-header">Nenhum item adicionado ainda.</div>`;
    return;
  }

  const grouped = getGroupedItems();
  let html = `<div class="items-list-header drag-header"><div>Itens organizados por ambiente</div><div>Total</div><div>Ações</div></div>`;

  grouped.forEach((envItems, ambiente) => {
    const subtotal = envItems.reduce((sum, item) => sum + item.quantidade * item.preco, 0);
    html += `
      <div class="sector-title">
        <span>${escapeHtml(ambiente)}</span>
        <small>Subtotal: ${toMoney(subtotal)}</small>
      </div>
      <div class="drag-tip">Arraste os itens deste ambiente para mudar a ordem. Clique em editar para alterar quantidade, preço ou ambiente.</div>
    `;

    envItems.forEach((item) => {
      const safeId = makeSafeId(item.id);

      if (editingItemId === item.id) {
        html += `
          <div class="item-line item-line-editing" data-item-id="${escapeHtml(item.id)}" data-ambiente="${escapeHtml(item.ambiente)}">
            <div class="edit-item-title">
              <strong>${escapeHtml(item.nome)}</strong>
              <span>Total atual: ${toMoney(item.quantidade * item.preco)}</span>
            </div>
            <div class="edit-grid">
              <label>Ambiente<input id="editAmbiente_${safeId}" value="${escapeHtml(item.ambiente)}" list="ambientesLista" /></label>
              <label>Quantidade<input id="editQuantidade_${safeId}" type="number" min="0" step="1" value="${item.quantidade}" /></label>
              <label>Preço unitário<input id="editPreco_${safeId}" type="number" min="0" step="0.01" value="${Number(item.preco).toFixed(2)}" /></label>
            </div>
            <div class="edit-actions">
              <button class="btn-success" type="button" onclick="saveEditItem('${item.id}')">Salvar</button>
              <button class="btn-secondary" type="button" onclick="cancelEditItem()">Cancelar</button>
            </div>
          </div>
        `;
        return;
      }

      html += `
        <div class="item-line" draggable="true" data-item-id="${escapeHtml(item.id)}" data-ambiente="${escapeHtml(item.ambiente)}">
          <div class="drag-handle" title="Arrastar item">☰</div>
          <div class="item-info">
            <strong>${item.quantidade} ${escapeHtml(item.unidade)} - ${escapeHtml(item.nome)}</strong>
            <span>${toMoney(item.preco)} cada</span>
          </div>
          <div class="item-total">${toMoney(item.quantidade * item.preco)}</div>
          <button class="btn-edit" title="Editar quantidade/preço" onclick="startEditItem('${item.id}')">✎</button>
          <button class="btn-danger" title="Remover" onclick="deleteItem('${item.id}')">×</button>
        </div>
      `;
    });
  });

  list.innerHTML = html;
  setupDragAndDrop();
}

function renderQuote() {
  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value || "";
  };

  setText("outEmpresaNome", $("empresaNome").value || "");
  setText("outEmpresaRazao", $("empresaRazao").value || "");
  setText("outEmpresaEndereco", $("empresaEndereco").value || "");
  setText("outEmpresaCidade", $("empresaCidade").value || "");
  setText("outEmpresaCnpj", $("empresaCnpj").value || "");
  setText("outEmpresaIe", $("empresaIe").value || "");
  setText("outEmpresaTelefone", $("empresaTelefone").value || "");
  setText("outClienteNome", $("clienteNome").value || "");
  setText("outClienteEndereco", $("clienteEndereco").value || "Não informado");
  setText("outPagamento", $("pagamento").value || "");
  setText("outCondicaoPagamento", $("pagamento").value || "");
  setText("outValidade", $("validade").value || "");
  setText("outValidadeResumo", $("validade").value || "");
  setText("outEntrega", $("entrega").value || "");
  setText("outEntregaResumo", $("entrega").value || "");

  const observacao = ($("observacaoGeral")?.value || "").trim();
  const observacaoBox = $("outObservacaoBox");
  const observacaoTexto = $("outObservacaoGeral");
  if (observacaoBox && observacaoTexto) {
    observacaoTexto.textContent = observacao;
    observacaoBox.classList.toggle("hidden-print-block", !observacao);
  }

  const body = $("orcamentoBody");
  const summaryBox = $("outResumoAmbientes");
  const grouped = getGroupedItems();
  let html = "";
  let summaryHtml = "";
  let totalGeral = 0;
  let totalItens = 0;

  if (!itens.length) {
    html = `<div class="empty-report">Adicione itens no painel ao lado ou carregue o exemplo para montar a proposta.</div>`;
    summaryHtml = `<div class="summary-empty">Nenhum ambiente adicionado ainda.</div>`;
  } else {
    grouped.forEach((envItems, ambiente) => {
      let subtotal = 0;
      totalItens += envItems.length;

      const rows = envItems.map((item) => {
        const total = item.quantidade * item.preco;
        subtotal += total;
        totalGeral += total;
        return `
          <tr>
            <td class="col-img"><img src="${item.imagem}" alt="${escapeHtml(item.nome)}" /></td>
            <td class="col-desc">
              <strong>${escapeHtml(item.nome)}</strong>
              <span>${escapeHtml(item.unidade)} · ${item.quantidade} unidade(s)</span>
            </td>
            <td class="col-qty">${item.quantidade}</td>
            <td class="col-unit">${escapeHtml(item.unidade)}</td>
            <td class="col-price">${toMoney(item.preco)}</td>
            <td class="col-total">${toMoney(total)}</td>
          </tr>
        `;
      }).join("");

      summaryHtml += `
        <div class="summary-card">
          <span>${escapeHtml(ambiente)}</span>
          <strong>${toMoney(subtotal)}</strong>
          <small>${envItems.length} item(ns)</small>
        </div>
      `;

      html += `
        <section class="environment-card">
          <div class="environment-card-head">
            <div>
              <span>Ambiente</span>
              <h3>${escapeHtml(ambiente)}</h3>
            </div>
            <div class="environment-subtotal">
              <span>Subtotal</span>
              <strong>${toMoney(subtotal)}</strong>
            </div>
          </div>
          <table class="premium-table">
            <thead>
              <tr>
                <th class="col-img">Imagem</th>
                <th class="col-desc">Descrição</th>
                <th class="col-qty">Quant.</th>
                <th class="col-unit">Un.</th>
                <th class="col-price">Vlr unit.</th>
                <th class="col-total">Vlr total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    });
  }

  body.innerHTML = html;
  if (summaryBox) summaryBox.innerHTML = summaryHtml;
  setText("outTotalGeral", toMoney(totalGeral));
  setText("outTotalGeralResumo", toMoney(totalGeral));
  updatePageNumbers();
}


function printQuote() {
  // Garante que campos digitados, como a observação geral, entrem na área do PDF antes da impressão.
  renderQuote();
  saveDraftLocal();
  setTimeout(() => window.print(), 80);
}

window.addEventListener("beforeprint", () => {
  renderQuote();
});

function updatePageNumbers() {
  const pages = Array.from(document.querySelectorAll("#quotePage .report-page"));
  const total = pages.length;
  pages.forEach((page, index) => {
    let marker = page.querySelector(".page-number");
    if (!marker) {
      marker = document.createElement("div");
      marker.className = "page-number";
      page.appendChild(marker);
    }
    marker.textContent = `Página ${index + 1} de ${total}`;
  });
}

function renderAll() {
  itens = itens.map(hydrateItem);
  renderItemsList();
  renderQuote();
  renderHistory();
}

function loadExample() {
  itens = DEFAULT_ITEMS.map((item) => {
    const product = getProduct(item.produtoId);
    return {
      id: newId("item"),
      ambiente: item.ambiente,
      produtoId: item.produtoId,
      nome: product?.nome,
      unidade: product?.unidade,
      imagem: product?.imagem,
      quantidade: item.quantidade,
      preco: item.preco
    };
  });
  loadedQuoteId = null;
  saveDraftLocal();
  renderAll();
}

function clearQuote() {
  if (!confirm("Deseja limpar todos os itens do orçamento?")) return;
  itens = [];
  loadedQuoteId = null;
  saveDraftLocal();
  renderAll();
}

function newQuote() {
  if (itens.length && !confirm("Criar um novo orçamento? O orçamento atual só ficará no histórico se você já tiver salvado.")) return;
  itens = [];
  loadedQuoteId = null;
  $("clienteNome").value = "";
  $("clienteEndereco").value = "";
  $("observacaoGeral").value = "";
  saveDraftLocal();
  renderAll();
  setStatus("Novo orçamento iniciado.", "info");
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("assets/img/spot_duplo_preto.svg");
    if (file.size > 500 * 1024) {
      return reject(new Error("A imagem é muito pesada. Use uma imagem menor que 500 KB nesta versão."));
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function saveProduct() {
  const nome = normalizeText($("novoProdutoNome").value);
  const unidade = normalizeText($("novoProdutoUnidade").value || "UND");
  const preco = onlyNumber($("novoProdutoPreco").value);
  const file = $("novoProdutoImagem").files[0];

  if (!currentUser) return alert("Faça login para cadastrar produto.");
  if (!nome) return alert("Informe o nome do produto.");
  if (preco <= 0) return alert("Informe o preço unitário.");

  try {
    const imagem = await readImageAsDataUrl(file);
    const novoProduto = { id: newId("produto"), nome, unidade, preco, imagem };
    await setDoc(doc(produtosCol(), novoProduto.id), {
      ...novoProduto,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });

    produtos.push(novoProduto);
    produtos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    $("novoProdutoNome").value = "";
    $("novoProdutoPreco").value = "";
    $("novoProdutoImagem").value = "";

    selectProduct(novoProduto.id);
    renderAll();
    setStatus("Produto salvo no Firestore.", "success");
  } catch (error) {
    console.error(error);
    alert(error.message || friendlyFirebaseError(error));
    setStatus(error.message || friendlyFirebaseError(error), "error");
  }
}

async function resetProducts() {
  if (!currentUser) return;
  if (!confirm("Restaurar a lista original de produtos? Os produtos cadastrados por você serão removidos.")) return;

  try {
    setStatus("Restaurando produtos...", "info");
    const snap = await getDocs(produtosCol());
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(produtosCol(), d.id))));
    await Promise.all(DEFAULT_PRODUCTS.map((p) => setDoc(doc(produtosCol(), p.id), {
      ...p,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    })));
    produtos = [...DEFAULT_PRODUCTS];
    renderProductOptions();
    renderAll();
    setStatus("Produtos restaurados.", "success");
  } catch (error) {
    console.error(error);
    setStatus(friendlyFirebaseError(error), "error");
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
  $("resetProdutos").addEventListener("click", resetProducts);
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

    if (!itens.length) loadExample();
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
