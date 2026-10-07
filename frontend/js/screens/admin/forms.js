/* ========== SHARED FORM HELPERS ========== */

/* Generic form field renderer */
function renderFormField(config) {
    const { label, type, name, value, options, placeholder, required } = config;
    let html = '<div class="form-group"><label class="form-label">' + label + (required ? ' *' : '') + '</label>';
    if (type === 'select') {
        html += '<select class="form-select" id="' + name + '">';
        html += '<option value="">Seleziona...</option>';
        (options || []).forEach(o => {
            html += '<option value="' + o.value + '"' + (value == o.value ? ' selected' : '') + '>' + o.label + '</option>';
        });
        html += '</select>';
    } else if (type === 'textarea') {
        html += '<textarea class="form-textarea" id="' + name + '" placeholder="' + (placeholder || '') + '">' + (value || '') + '</textarea>';
    } else {
        html += '<input class="form-input" type="' + (type || 'text') + '" id="' + name + '" value="' + (value || '') + '" placeholder="' + (placeholder || '') + '">';
    }
    html += '</div>';
    return html;
}

/* Get form data from named fields */
function getFormData(fields) {
    const data = {};
    fields.forEach(f => {
        const el = document.getElementById(f);
        if (el) data[f] = el.value || null;
    });
    return data;
}

/* Validate required fields */
function validateRequired(data, requiredFields) {
    for (const f of requiredFields) {
        if (!data[f]) {
            showToast('Campo obbligatorio: ' + f, 'error');
            return false;
        }
    }
    return true;
}
