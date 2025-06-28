// --- STATE MANAGEMENT ---
let currentApuId = null;
let materials = []; let labor = []; let equipment = []; let transport = [];
let insumos = []; let personnel = []; let savedApus = [];
let editingInsumoId = null; let editingPersonnelId = null;
let apuForExport = null;

// --- LOCAL STORAGE LOGIC ---
const loadFromLocalStorage = (key, defaultValue = []) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
};
const saveToLocalStorage = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
};

// --- UTILS & HELPERS ---
const $ = (id) => document.getElementById(id);
const formatCurrency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
const showToast = (message, type = 'success', duration = 3000) => { const toast = $('toast'); toast.textContent = message; toast.className = `toast show ${type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`; setTimeout(() => { toast.className = toast.className.replace("show", ""); }, duration); };

function setupModal(modalId, backdropId, openBtnId, closeBtnId, onOpen = () => {}) { 
    const modal = $(modalId), backdrop = $(backdropId), openBtn = $(openBtnId), closeBtn = $(closeBtnId); 
    const open = () => { onOpen(); modal.style.display = 'block'; backdrop.style.display = 'block'; }; 
    const close = () => { modal.style.display = 'none'; backdrop.style.display = 'none'; }; 
    if(openBtn) openBtn.addEventListener('click', open); 
    if(closeBtn) closeBtn.addEventListener('click', close); 
    if(backdrop) backdrop.addEventListener('click', close); 
    return { open, close }; 
}

const apusModal = setupModal('savedApusModal', 'savedApusModalBackdrop', 'viewSavedApusBtn', 'closeApusModalBtn', () => {
     $('apuSearchInput').value = '';
     renderSavedApus(savedApus, '');
});
const insumosModal = setupModal('insumosModal', 'insumosModalBackdrop', 'manageInsumosBtn', 'closeInsumosModalBtn');
const personnelModal = setupModal('personnelModal', 'personnelModalBackdrop', 'managePersonnelBtn', 'closePersonnelModalBtn');
const viewerModal = setupModal('viewerModal', 'viewerModalBackdrop', null, 'closeViewerModalBtn');
let confirmCallback = null;
const confirmModal = setupModal('confirmModal', 'confirmModalBackdrop', null, 'confirmModalCancelBtn');
$('confirmModalCancelBtn').addEventListener('click', confirmModal.close);
$('confirmModalConfirmBtn').addEventListener('click', () => { if(confirmCallback) confirmCallback(); confirmModal.close(); });
function showConfirm(title, text, onConfirm) { $('confirmModalTitle').textContent = title; $('confirmModalText').textContent = text; confirmCallback = onConfirm; confirmModal.open(); }

// --- CORE LOGIC & RENDERING ---
function calculateAll() { let subtotalMaterials = materials.reduce((acc, item) => acc + ((item.quantity || 0) * (item.price || 0)), 0); let subtotalLabor = labor.reduce((acc, item) => acc + ((item.quantity || 1) * (item.performance || 0) * (item.price || 0)), 0); const herramientaMenorPct = parseFloat($('herramienta-menor-pct').value) || 0; const herramientaMenorValue = subtotalLabor * (herramientaMenorPct / 100); let subtotalManualEquipment = equipment.reduce((acc, item) => acc + ((item.performance || 0) * (item.price || 0)), 0); let subtotalEquipment = subtotalManualEquipment + herramientaMenorValue; renderHerramientaMenor(herramientaMenorPct, subtotalLabor, herramientaMenorValue); let subtotalTransport = transport.reduce((acc, item) => acc + ((item.quantity || 0) * (item.price || 0)), 0); let directCost = subtotalMaterials + subtotalLabor + subtotalEquipment + subtotalTransport; let adminPercentage = parseFloat($('admin-percentage').value) || 0; let imprevistosPercentage = parseFloat($('imprevistos-percentage').value) || 0; let utilidadPercentage = parseFloat($('utilidad-percentage').value) || 0; let adminValue = directCost * (adminPercentage / 100); let imprevistosValue = directCost * (imprevistosPercentage / 100); let utilidadValue = directCost * (utilidadPercentage / 100); let indirectCost = adminValue + imprevistosValue + utilidadValue; let totalCost = directCost + indirectCost; $('subtotal-materials').textContent = formatCurrency(subtotalMaterials); $('subtotal-labor').textContent = formatCurrency(subtotalLabor); $('subtotal-equipment').textContent = formatCurrency(subtotalEquipment); $('subtotal-transport').textContent = formatCurrency(subtotalTransport); $('direct-cost').textContent = formatCurrency(directCost); $('admin-value').textContent = formatCurrency(adminValue); $('imprevistos-value').textContent = formatCurrency(imprevistosValue); $('utilidad-value').textContent = formatCurrency(utilidadValue); $('indirect-cost-display').textContent = formatCurrency(indirectCost); $('total-cost').textContent = formatCurrency(totalCost); $('total-unit-label').textContent = $('activityUnit').value || 'UNIDAD'; }
function renderHerramientaMenor(pct, base, value) { const container = $('herramienta-menor-container'); if (pct > 0) { container.innerHTML = ` <tr class="bg-yellow-50 border-t"> <td class="px-6 py-2 font-medium text-gray-700 italic">Herramienta Menor</td> <td class="px-6 py-2 italic">% Mano de Obra</td> <td class="px-6 py-2 italic text-right">${pct}%</td> <td class="px-6 py-2 italic text-right">${formatCurrency(base)}</td> <td class="px-6 py-2 font-semibold italic text-right">${formatCurrency(value)}</td> <td class="px-2 py-2"></td> </tr> `; } else { container.innerHTML = ''; } }

function renderTable(type, data, tableBodyId) {
    const tableBody = $(tableBodyId);
    tableBody.innerHTML = '';
    data.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = 'bg-white border-b hover:bg-gray-50';
        let rowHtml = '';
        const price = item.price || 0;

        if (type === 'labor') {
            const quantity = item.quantity || 1;
            const performance = item.performance || 0;
            const total = quantity * performance * price;
            rowHtml = `
                <td class="px-6 py-2 font-medium">${item.description}</td>
                <td class="px-6 py-2">${item.unit}</td>
                <td class="px-6 py-2 text-right">${quantity}</td>
                <td class="px-6 py-2 text-right">${performance}</td>
                <td class="px-6 py-2 text-right">${formatCurrency(price)}</td>
                <td class="px-6 py-2 font-bold text-right">${formatCurrency(total)}</td>
            `;
        } else {
            const quantityLabel = (type === 'equipment') ? item.performance : item.quantity;
            const total = (quantityLabel || 0) * price;
             rowHtml = `
                <td class="px-6 py-2 font-medium">${item.description}</td>
                <td class="px-6 py-2">${item.unit}</td>
                <td class="px-6 py-2 text-right">${quantityLabel}</td>
                <td class="px-6 py-2 text-right">${formatCurrency(price)}</td>
                <td class="px-6 py-2 font-bold text-right">${formatCurrency(total)}</td>
            `;
        }
        
        row.innerHTML = `${rowHtml}<td class="px-2 py-2 text-center"><button class="remove-item-btn text-red-500 hover:text-red-700" data-type="${type}" data-index="${index}"><i class="fas fa-trash-alt"></i></button></td>`;
        tableBody.appendChild(row);
    });
    calculateAll();
}

function addItem(type) { if (type === 'material') { const desc = $('material-selector').value; const insumo = insumos.find(i => i.description === desc && i.type === 'material'); if(!insumo) return showToast('Seleccione un material válido.', 'error'); const quantity = parseFloat($('material-quantity').value) || 0; if (quantity <= 0) return showToast('Ingrese una cantidad válida.', 'error'); materials.push({ ...insumo, quantity }); renderTable('material', materials, 'materials-table'); $('material-selector').value = ''; $('material-quantity').value = ''; $('material-selector').focus(); } else if (type === 'equipment') { const desc = $('equipment-selector').value; const insumo = insumos.find(i => i.description === desc && i.type === 'equipment'); if(!insumo) return showToast('Seleccione un equipo válido.', 'error'); const performance = parseFloat($('equipment-performance').value) || 0; if (performance <= 0) return showToast('Ingrese un rendimiento válido.', 'error'); equipment.push({ description: insumo.description, unit: insumo.unit, performance, price: insumo.price }); renderTable('equipment', equipment, 'equipment-table'); $('equipment-selector').value = ''; $('equipment-performance').value = ''; $('equipment-selector').focus(); } else if (type === 'labor') { const desc = $('labor-selector').value; const person = personnel.find(p => p.description === desc); if(!person) return showToast('Seleccione un cargo válido de la lista.', 'error'); const quantity = parseFloat($('labor-quantity').value) || 0; const performance = parseFloat($('labor-performance').value) || 0; if (quantity <= 0) return showToast('Ingrese una cantidad de personal válida.', 'error'); if (performance <= 0) return showToast('Ingrese un rendimiento válido.', 'error'); labor.push({ description: person.description, unit: 'Jornal', quantity, performance, price: person.totalWage }); renderTable('labor', labor, 'labor-table'); $('labor-selector').value = ''; $('labor-quantity').value = '1'; $('labor-performance').value = ''; $('labor-selector').focus(); } else if (type === 'transport') { const desc = $('transport-description').value, unit = $('transport-unit').value, price = parseFloat($('transport-price').value) || 0; if(!desc || !unit || !price) return showToast(`Complete todos los campos de transporte.`, 'error'); const quant = parseFloat($('transport-quantity').value) || 0; if(quant <= 0) return showToast('Ingrese una cantidad válida.', 'error'); transport.push({ description: desc, unit, quantity: quant, price }); renderTable('transport', transport, 'transport-table'); $('transport-description').value = ''; $('transport-unit').value = ''; $('transport-price').value = ''; $('transport-quantity').value = ''; $('transport-description').focus(); } }
function removeItem(type, index) { if(type === 'material') materials.splice(index, 1); if(type === 'labor') labor.splice(index, 1); if(type === 'equipment') equipment.splice(index, 1); if(type === 'transport') transport.splice(index, 1); renderAllTables(); }
function renderAllTables() { renderTable('material', materials, 'materials-table'); renderTable('labor', labor, 'labor-table'); renderTable('equipment', equipment, 'equipment-table'); renderTable('transport', transport, 'transport-table'); }
function resetForm() { currentApuId = null; materials = []; labor = []; equipment = []; transport = []; $('activityName').value = ''; $('activityUnit').value = ''; $('admin-percentage').value = '15'; $('imprevistos-percentage').value = '5'; $('utilidad-percentage').value = '5'; $('herramienta-menor-pct').value = '0'; renderAllTables(); showToast('Formulario limpiado.'); $('activityName').focus(); }
function loadApuIntoForm(apu) { currentApuId = apu.id; $('activityName').value = apu.activityName; $('activityUnit').value = apu.activityUnit; $('admin-percentage').value = apu.adminPercentage || 15; $('imprevistos-percentage').value = apu.imprevistosPercentage || 5; $('utilidad-percentage').value = apu.utilidadPercentage || 5; $('herramienta-menor-pct').value = apu.herramientaMenorPct || 0; materials = apu.materials || []; labor = apu.labor || []; equipment = apu.equipment || []; transport = apu.transport || []; renderAllTables(); apusModal.close(); showToast(`APU "${apu.activityName}" cargado para editar.`); }

// --- LOCAL DATA OPERATIONS ---
function saveApu() { if (!$('activityName').value || !$('activityUnit').value) return showToast('Nombre y unidad son obligatorios.', 'error'); const apuData = { id: currentApuId || crypto.randomUUID(), activityName: $('activityName').value, activityUnit: $('activityUnit').value, materials, labor, equipment, transport, adminPercentage: parseFloat($('admin-percentage').value) || 0, imprevistosPercentage: parseFloat($('imprevistos-percentage').value) || 0, utilidadPercentage: parseFloat($('utilidad-percentage').value) || 0, herramientaMenorPct: parseFloat($('herramienta-menor-pct').value) || 0, createdAt: new Date().toISOString() }; if (currentApuId) { const index = savedApus.findIndex(apu => apu.id === currentApuId); savedApus[index] = apuData; } else { savedApus.push(apuData); } saveToLocalStorage('apu_savedApus', savedApus); showToast('APU guardado localmente.'); resetForm(); }
function deleteApuFromDb(apuId) { showConfirm('Eliminar APU', '¿Estás seguro? Esta acción no se puede deshacer.', () => { savedApus = savedApus.filter(apu => apu.id !== apuId); saveToLocalStorage('apu_savedApus', savedApus); renderSavedApus(savedApus); showToast('APU eliminado.'); }); }

function renderSavedApus(apus, searchTerm = '') {
    const listContainer = $('savedApusList');
    let filteredApus = apus;
    if (searchTerm) { const lowerCaseSearchTerm = searchTerm.toLowerCase(); filteredApus = apus.filter(apu => apu.activityName.toLowerCase().includes(lowerCaseSearchTerm)); }
    if (filteredApus.length === 0) { listContainer.innerHTML = `<p class="text-gray-500 text-center">${searchTerm ? 'No se encontraron APUs.' : 'No tienes APUs guardados.'}</p>`; return; }
    listContainer.innerHTML = ''; 
    filteredApus.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(apu => { const l = (apu.labor||[]).reduce((s,i)=>s+((i.quantity || 1) * (i.performance || 0) * (i.price || 0)),0); const m = (apu.materials||[]).reduce((s,i)=>s+((i.quantity || 0) * (i.price || 0)),0); const e = (apu.equipment||[]).reduce((s,i)=>s+((i.performance || 0) * (i.price || 0)),0) + (l * ((apu.herramientaMenorPct || 0)/100)); const t = (apu.transport||[]).reduce((s,i)=>s+((i.quantity || 0) * (i.price || 0)),0); const directCost = m + l + e + t; const totalAIUPercent = (apu.adminPercentage || 0) + (apu.imprevistosPercentage || 0) + (apu.utilidadPercentage || 0); const totalCost = directCost * (1 + (totalAIUPercent / 100)); const item = document.createElement('div'); item.className = 'p-4 border rounded-lg mb-3 hover:bg-gray-50 flex justify-between items-center'; item.innerHTML = `<div><p class="font-bold text-lg text-indigo-700">${apu.activityName}</p><p class="text-sm text-gray-600">Unidad: ${apu.activityUnit} | Total: <span class="font-semibold">${formatCurrency(totalCost)}</span></p></div><div class="flex items-center space-x-2"><button class="view-apu-btn bg-sky-500 text-white p-2 rounded-lg hover:bg-sky-600" title="Ver/Exportar APU"><i class="fas fa-eye"></i></button><button class="edit-apu-btn bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600" title="Cargar para Editar"><i class="fas fa-pencil-alt"></i></button><button class="delete-apu-btn bg-red-500 text-white p-2 rounded-lg hover:bg-red-600" title="Eliminar APU"><i class="fas fa-trash"></i></button></div>`; listContainer.appendChild(item); item.querySelector('.view-apu-btn').addEventListener('click', () => displayApuInViewer(apu)); item.querySelector('.edit-apu-btn').addEventListener('click', () => loadApuIntoForm(apu)); item.querySelector('.delete-apu-btn').addEventListener('click', () => deleteApuFromDb(apu.id)); });
}

// --- INSUMOS & PERSONNEL LOGIC ---
function renderInsumosTable(list) { const body = $('insumos-table-body'); if (list.length === 0) { body.innerHTML = `<tr><td colspan="5" class="text-center p-4">Aún no has añadido insumos.</td></tr>`; return; } body.innerHTML = ''; list.sort((a, b) => a.description.localeCompare(b.description)).forEach(item => { const row = document.createElement('tr'); row.className = 'bg-white border-b hover:bg-gray-50'; const typeText = item.type === 'material' ? 'Material' : 'Equipo'; const typeColor = item.type === 'material' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'; row.innerHTML = `<td class="px-4 py-2 font-medium">${item.description}</td><td class="px-4 py-2">${item.unit}</td><td class="px-4 py-2">${formatCurrency(item.price)}</td><td class="px-4 py-2"><span class="px-2 py-1 text-xs font-medium rounded-full ${typeColor}">${typeText}</span></td><td class="px-1 py-2 text-center space-x-2"><button class="edit-insumo-btn text-blue-500 hover:text-blue-700"><i class="fas fa-pencil-alt"></i></button><button class="delete-insumo-btn text-red-500 hover:text-red-700"><i class="fas fa-trash-alt"></i></button></td>`; body.appendChild(row); row.querySelector('.edit-insumo-btn').addEventListener('click', () => startEditInsumo(item)); row.querySelector('.delete-insumo-btn').addEventListener('click', () => deleteInsumo(item.id)); }); }
function renderInsumosDatalists(list) { const materialsList = $('materials-datalist'), equipmentsList = $('equipments-datalist'); materialsList.innerHTML = ''; equipmentsList.innerHTML = ''; list.forEach(item => { const option = `<option value="${item.description}"></option>`; if(item.type === 'material') materialsList.innerHTML += option; else if(item.type === 'equipment') equipmentsList.innerHTML += option; }); }
function resetInsumoForm() { editingInsumoId = null; $('add-insumo-form').reset(); $('editing-insumo-id').value = ''; $('insumo-form-title').textContent = 'Añadir Nuevo Insumo'; $('insumo-submit-btn').textContent = 'Añadir a la Base'; $('insumo-submit-btn').classList.replace('bg-orange-500', 'bg-teal-500'); $('insumo-submit-btn').classList.replace('hover:bg-orange-600', 'hover:bg-teal-600'); $('insumo-cancel-btn').classList.add('hidden'); }
function startEditInsumo(item) { editingInsumoId = item.id; $('editing-insumo-id').value = item.id; $('insumo-form-title').textContent = 'Editando Insumo'; $('insumo-type').value = item.type; $('insumo-description').value = item.description; $('insumo-unit').value = item.unit; $('insumo-price').value = item.price; $('insumo-submit-btn').textContent = 'Actualizar Insumo'; $('insumo-submit-btn').classList.replace('bg-teal-500', 'bg-orange-500'); $('insumo-submit-btn').classList.replace('hover:bg-teal-600', 'hover:bg-orange-600'); $('insumo-cancel-btn').classList.remove('hidden'); }
$('insumo-cancel-btn').addEventListener('click', resetInsumoForm);
$('add-insumo-form').addEventListener('submit', (e) => { e.preventDefault(); const data = { id: editingInsumoId || crypto.randomUUID(), type: $('insumo-type').value, description: $('insumo-description').value, unit: $('insumo-unit').value, price: parseFloat($('insumo-price').value) || 0 }; if(!data.description || !data.unit || !data.price) return showToast('Todos los campos son obligatorios', 'error'); if (editingInsumoId) { const index = insumos.findIndex(i => i.id === editingInsumoId); insumos[index] = data; showToast('Insumo actualizado'); } else { insumos.push(data); showToast('Insumo añadido'); } saveToLocalStorage('apu_insumos', insumos); renderInsumosTable(insumos); renderInsumosDatalists(insumos); resetInsumoForm(); });
function deleteInsumo(id) { showConfirm('Eliminar Insumo', '¿Seguro que quieres eliminar este insumo?', () => { insumos = insumos.filter(i => i.id !== id); saveToLocalStorage('apu_insumos', insumos); renderInsumosTable(insumos); renderInsumosDatalists(insumos); showToast('Insumo eliminado.'); }); }
function renderPersonnelTable(list) { const body = $('personnel-table-body'); if (list.length === 0) { body.innerHTML = `<tr><td colspan="5" class="text-center p-4">Aún no has añadido personal.</td></tr>`; return; } body.innerHTML = ''; list.sort((a, b) => a.description.localeCompare(b.description)).forEach(item => { const row = document.createElement('tr'); row.className = 'bg-white border-b hover:bg-gray-50'; row.innerHTML = `<td class="px-4 py-2 font-medium">${item.description}</td><td class="px-4 py-2">${formatCurrency(item.basicWage)}</td><td class="px-4 py-2">${item.benefitsPct}%</td><td class="px-4 py-2 font-bold">${formatCurrency(item.totalWage)}</td><td class="px-1 py-2 text-center space-x-2"><button class="edit-personnel-btn text-blue-500 hover:text-blue-700"><i class="fas fa-pencil-alt"></i></button><button class="delete-personnel-btn text-red-500 hover:text-red-700"><i class="fas fa-trash-alt"></i></button></td>`; body.appendChild(row); row.querySelector('.edit-personnel-btn').addEventListener('click', () => startEditPersonnel(item)); row.querySelector('.delete-personnel-btn').addEventListener('click', () => deletePersonnel(item.id)); }); }
function renderPersonnelDatalist(list) { const datalist = $('labor-datalist'); datalist.innerHTML = ''; list.forEach(item => { datalist.innerHTML += `<option value="${item.description}"></option>`; }); }
function resetPersonnelForm() { editingPersonnelId = null; $('add-personnel-form').reset(); $('editing-personnel-id').value = ''; $('personnel-form-title').textContent = 'Añadir Nuevo Personal'; $('personnel-submit-btn').textContent = 'Añadir a la Base'; $('personnel-submit-btn').classList.replace('bg-orange-500', 'bg-purple-500'); $('personnel-submit-btn').classList.replace('hover:bg-orange-600', 'hover:bg-purple-600'); $('personnel-cancel-btn').classList.add('hidden'); }
function startEditPersonnel(item) { editingPersonnelId = item.id; $('editing-personnel-id').value = item.id; $('personnel-form-title').textContent = 'Editando Personal'; $('personnel-description').value = item.description; $('personnel-wage').value = item.basicWage; $('personnel-benefits').value = item.benefitsPct; $('personnel-submit-btn').textContent = 'Actualizar Personal'; $('personnel-submit-btn').classList.replace('bg-purple-500', 'bg-orange-500'); $('personnel-submit-btn').classList.replace('hover:bg-purple-600', 'hover:bg-orange-600'); $('personnel-cancel-btn').classList.remove('hidden'); }
$('personnel-cancel-btn').addEventListener('click', resetPersonnelForm);
$('add-personnel-form').addEventListener('submit', (e) => { e.preventDefault(); const data = { id: editingPersonnelId || crypto.randomUUID(), description: $('personnel-description').value, basicWage: parseFloat($('personnel-wage').value) || 0, benefitsPct: parseFloat($('personnel-benefits').value) || 0, }; if(!data.description || !data.basicWage) return showToast('Cargo y Jornal Básico son obligatorios', 'error'); data.totalWage = data.basicWage * (1 + (data.benefitsPct / 100)); if (editingPersonnelId) { const index = personnel.findIndex(p => p.id === editingPersonnelId); personnel[index] = data; showToast('Personal actualizado'); } else { personnel.push(data); showToast('Personal añadido'); } saveToLocalStorage('apu_personnel', personnel); renderPersonnelTable(personnel); renderPersonnelDatalist(personnel); resetPersonnelForm(); });
function deletePersonnel(id) { showConfirm('Eliminar Personal', '¿Seguro que quieres eliminar este cargo?', () => { personnel = personnel.filter(p => p.id !== id); saveToLocalStorage('apu_personnel', personnel); renderPersonnelTable(personnel); renderPersonnelDatalist(personnel); showToast('Personal eliminado.'); }); }

// --- APU VIEWER AND EXPORT LOGIC ---
function displayApuInViewer(apu) {
    apuForExport = apu;
    const container = $('apuViewerContainer');
    const subtotalLabor = (apu.labor || []).reduce((s, i) => s + ((i.quantity || 1) * (i.performance || 0) * (i.price || 0)), 0);
    const herramientaMenorPct = apu.herramientaMenorPct || 0;
    const herramientaMenorValue = subtotalLabor * (herramientaMenorPct / 100);
    const subtotalManualEquipment = (apu.equipment || []).reduce((s, i) => s + ((i.performance || 0) * (i.price || 0)), 0);
    const subtotalEquipment = subtotalManualEquipment + herramientaMenorValue;
    const subtotalMaterials = (apu.materials || []).reduce((s, i) => s + ((i.quantity || 0) * (i.price || 0)), 0);
    const subtotalTransport = (apu.transport || []).reduce((s, i) => s + ((i.quantity || 0) * (i.price || 0)), 0);
    const directCost = subtotalMaterials + subtotalLabor + subtotalEquipment + subtotalTransport;
    const adminValue = directCost * ((apu.adminPercentage || 0) / 100);
    const imprevistosValue = directCost * ((apu.imprevistosPercentage || 0) / 100);
    const utilidadValue = directCost * ((apu.utilidadPercentage || 0) / 100);
    const indirectCost = adminValue + imprevistosValue + utilidadValue;
    const totalCost = directCost + indirectCost;
    
    const createTable = (title, headers, data, type) => {
        let rows = ''; let subtotal = 0;
        
        const headerHtml = headers.map(h => {
            const alignClass = ['Unidad', 'Cantidad', 'Rendimiento', 'Rendimiento / %'].includes(h) ? 'text-center' : 'text-left';
            return `<th class="px-4 py-2 ${alignClass}">${h}</th>`;
        }).join('');

        if(data && data.length > 0) {
            data.forEach(item => {
                const price = item.price || 0;
                let total, cells;
                if (type === 'labor') {
                    const quantity = item.quantity || 1;
                    const performance = item.performance || 0;
                    total = quantity * performance * price;
                    cells = `<td class="px-4 py-2">${item.description}</td><td class="px-4 py-2 text-center">${item.unit}</td><td class="px-4 py-2 text-center">${quantity}</td><td class="px-4 py-2 text-center">${performance}</td><td class="px-4 py-2 text-right">${formatCurrency(price)}</td><td class="px-4 py-2 text-right font-semibold">${formatCurrency(total)}</td>`;
                } else {
                    const quantityLabel = (type === 'equipment') ? item.performance : item.quantity;
                    total = (quantityLabel || 0) * price;
                    cells = `<td class="px-4 py-2">${item.description}</td><td class="px-4 py-2 text-center">${item.unit}</td><td class="px-4 py-2 text-center">${quantityLabel}</td><td class="px-4 py-2 text-right">${formatCurrency(price)}</td><td class="px-4 py-2 text-right font-semibold">${formatCurrency(total)}</td>`;
                }
                subtotal += total;
                rows += `<tr class="border-b">${cells}</tr>`;
            });
        }
        if (type === 'equipment' && herramientaMenorPct > 0) {
            rows += `<tr class="bg-yellow-50 border-b"><td class="px-4 py-2 italic">Herramienta Menor</td><td class="px-4 py-2 text-center italic">% Mano de Obra</td><td class="px-4 py-2 text-center italic">${herramientaMenorPct}%</td><td class="px-4 py-2 text-right italic">${formatCurrency(subtotalLabor)}</td><td class="px-4 py-2 text-right font-semibold italic">${formatCurrency(herramientaMenorValue)}</td></tr>`;
            subtotal += herramientaMenorValue;
        }
        if (!rows) return '';
        const colspan = headers.length - 1;
        return `<div class="mb-8"><h3 class="text-xl font-bold text-gray-700 mb-2 border-b-2 pb-1">${title}</h3><table class="w-full text-sm"><thead><tr class="border-b-2">${headerHtml}</tr></thead><tbody>${rows}</tbody><tfoot><tr class="border-t-2"><td colspan="${colspan}" class="text-right font-bold px-4 py-2">SUBTOTAL:</td><td class="text-right font-bold px-4 py-2">${formatCurrency(subtotal)}</td></tr></tfoot></table></div>`;
    };

    container.innerHTML = `<div class="p-4"><h1 class="text-3xl font-bold text-center mb-2">${apu.activityName}</h1><p class="text-center text-lg text-gray-600 mb-8">Unidad: ${apu.activityUnit}</p>${createTable('Materiales', ['Descripción', 'Unidad', 'Cantidad', 'Vr. Unitario', 'Total'], apu.materials, 'material')}${createTable('Transporte', ['Descripción', 'Unidad', 'Cantidad', 'Vr. Unitario', 'Total'], apu.transport, 'transport')}${createTable('Equipos y Herramientas', ['Descripción', 'Unidad', 'Rendimiento / %', 'Vr. Unitario / Base', 'Total'], apu.equipment, 'equipment')}${createTable('Mano de Obra', ['Descripción', 'Unidad', 'Cantidad', 'Rendimiento', 'Vr. Unitario', 'Total'], apu.labor, 'labor')}<div class="mt-10 max-w-md ml-auto space-y-2 text-sm"><div class="flex justify-between p-2 bg-gray-100 rounded"><span class="font-semibold">COSTO DIRECTO (A)</span><span class="font-bold">${formatCurrency(directCost)}</span></div><div class="flex justify-between p-2"><span class="pl-4">Administración (${apu.adminPercentage}%)</span><span>${formatCurrency(adminValue)}</span></div><div class="flex justify-between p-2"><span class="pl-4">Imprevistos (${apu.imprevistosPercentage}%)</span><span>${formatCurrency(imprevistosValue)}</span></div><div class="flex justify-between p-2"><span class="pl-4">Utilidad (${apu.utilidadPercentage}%)</span><span>${formatCurrency(utilidadValue)}</span></div><div class="flex justify-between p-2 bg-gray-100 rounded"><span class="font-semibold">COSTOS INDIRECTOS (B)</span><span class="font-bold">${formatCurrency(indirectCost)}</span></div><div class="flex justify-between p-3 bg-green-600 text-white rounded mt-2 text-base"><span class="font-bold">PRECIO TOTAL (A+B) / ${apu.activityUnit}</span><span class="font-bold">${formatCurrency(totalCost)}</span></div></div></div>`;
    viewerModal.open();
}

async function downloadPdf() {
    if (!apuForExport) return;
    const content = $('apuViewerContainer');
    const btn = $('downloadPdfBtn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    
    // Temporarily resize container to capture full content
    const originalStyles = { maxHeight: content.style.maxHeight, overflowY: content.style.overflowY };
    content.style.maxHeight = 'none';
    content.style.overflowY = 'visible';

    try {
        const canvas = await html2canvas(content, { scale: 2, windowWidth: content.scrollWidth, windowHeight: content.scrollHeight });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = canvas.height * pdfWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = -heightLeft;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }
        
        pdf.save(`APU-${apuForExport.activityName.replace(/ /g, "_")}.pdf`);
    } catch(e) {
        console.error("Error generating PDF:", e);
        showToast("No se pudo generar el PDF.", "error");
    } finally {
        // Restore original styles
        content.style.maxHeight = originalStyles.maxHeight;
        content.style.overflowY = originalStyles.overflowY;
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-file-pdf"></i> PDF`;
    }
}

function downloadExcel() {
    if (!apuForExport) return;
    const wb = XLSX.utils.book_new();
    const subtotalLabor = (apuForExport.labor || []).reduce((s, i) => s + ((i.quantity || 1) * (i.performance || 0) * (i.price || 0)), 0);
    const herramientaMenorPct = apuForExport.herramientaMenorPct || 0;
    const herramientaMenorValue = subtotalLabor * (herramientaMenorPct / 100);
    const subtotalManualEquipment = (apuForExport.equipment || []).reduce((s, i) => s + ((i.performance || 0) * (i.price || 0)), 0);
    const subtotalEquipment = subtotalManualEquipment + herramientaMenorValue;
    const subtotalMaterials = (apuForExport.materials||[]).reduce((s,i)=>s+((i.quantity||0)*(i.price||0)),0);
    const subtotalTransport = (apuForExport.transport||[]).reduce((s,i)=>s+((i.quantity||0)*(i.price||0)),0);
    const directCost = subtotalMaterials + subtotalLabor + subtotalEquipment + subtotalTransport;
    const adminValue = directCost * ((apuForExport.adminPercentage||0)/100); const imprevistosValue = directCost * ((apuForExport.imprevistosPercentage||0)/100); const utilidadValue = directCost * ((apuForExport.utilidadPercentage||0)/100); const indirectCost = adminValue + imprevistosValue + utilidadValue; const totalCost = directCost + indirectCost;
    const summaryData = [["Actividad", apuForExport.activityName],["Unidad", apuForExport.activityUnit],[],["CONCEPTO", "VALOR"],["Costo Directo (A)", directCost],[`Administración (${apuForExport.adminPercentage}%)`, adminValue],[`Imprevistos (${apuForExport.imprevistosPercentage}%)`, imprevistosValue],[`Utilidad (${apuForExport.utilidadPercentage}%)`, utilidadValue],["Costos Indirectos (B)", indirectCost],["PRECIO TOTAL (A+B)", totalCost]]; const wsSummary = XLSX.utils.aoa_to_sheet(summaryData); XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
    if (apuForExport.materials?.length) { const wsMaterials = XLSX.utils.json_to_sheet(apuForExport.materials.map(m => ({'Descripción': m.description, 'Unidad': m.unit, 'Cantidad': m.quantity, 'Vr. Unitario': m.price, 'Total': m.quantity * m.price }))); XLSX.utils.book_append_sheet(wb, wsMaterials, "Materiales"); }
    if (apuForExport.labor?.length) { const wsLabor = XLSX.utils.json_to_sheet(apuForExport.labor.map(m => ({'Descripción': m.description, 'Unidad': m.unit, 'Cantidad': m.quantity, 'Rendimiento': m.performance, 'Vr. Unitario': m.price, 'Total': m.quantity * m.performance * m.price }))); XLSX.utils.book_append_sheet(wb, wsLabor, "Mano de Obra"); }
    if ((apuForExport.equipment?.length) || herramientaMenorPct > 0) { const equipmentData = apuForExport.equipment.map(m => ({'Descripción': m.description, 'Unidad': m.unit, 'Rendimiento': m.performance, 'Vr. Unitario': m.price, 'Total': m.performance * m.price })); if(herramientaMenorPct > 0) { equipmentData.push({ 'Descripción': 'Herramienta Menor', 'Unidad': `% Mano de Obra`, 'Rendimiento': herramientaMenorPct, 'Vr. Unitario': subtotalLabor, 'Total': herramientaMenorValue }); } const wsEquipment = XLSX.utils.json_to_sheet(equipmentData); XLSX.utils.book_append_sheet(wb, wsEquipment, "Equipos"); }
    if (apuForExport.transport?.length) { const wsTransport = XLSX.utils.json_to_sheet(apuForExport.transport.map(m => ({'Descripción': m.description, 'Unidad': m.unit, 'Cantidad': m.quantity, 'Vr. Unitario': m.price, 'Total': m.quantity * m.price }))); XLSX.utils.book_append_sheet(wb, wsTransport, "Transporte"); }
    XLSX.writeFile(wb, `APU-${apuForExport.activityName.replace(/ /g, "_")}.xlsx`);
}

$('downloadPdfBtn').addEventListener('click', downloadPdf);
$('downloadExcelBtn').addEventListener('click', downloadExcel);

// --- EVENT LISTENERS ---
$('add-material-btn').addEventListener('click', () => addItem('material')); $('add-labor-btn').addEventListener('click', () => addItem('labor')); $('add-equipment-btn').addEventListener('click', () => addItem('equipment')); $('add-transport-btn').addEventListener('click', () => addItem('transport')); 
['materials-table', 'labor-table', 'equipment-table', 'transport-table'].forEach(id => { $(id).addEventListener('click', (e) => { const btn = e.target.closest('.remove-item-btn'); if (btn) removeItem(btn.dataset.type, btn.dataset.index); }); });
[$('activityUnit'), $('admin-percentage'), $('imprevistos-percentage'), $('utilidad-percentage'), $('herramienta-menor-pct')].forEach(el => el.addEventListener('input', calculateAll));
$('newApuBtn').addEventListener('click', resetForm);
$('saveApuBtn').addEventListener('click', saveApu);
$('apuSearchInput').addEventListener('input', (e) => renderSavedApus(savedApus, e.target.value));
$('clear-herramienta-menor-btn').addEventListener('click', () => { $('herramienta-menor-pct').value = 0; calculateAll(); });

// --- INITIAL LOAD ---
window.onload = () => {
    insumos = loadFromLocalStorage('apu_insumos');
    personnel = loadFromLocalStorage('apu_personnel');
    savedApus = loadFromLocalStorage('apu_savedApus');
    
    renderInsumosTable(insumos);
    renderInsumosDatalists(insumos);
    renderPersonnelTable(personnel);
    renderPersonnelDatalist(personnel);
    renderSavedApus(savedApus);
    
    calculateAll();
}
