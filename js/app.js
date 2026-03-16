import { initState } from './state.js';
import { showToast } from './utils.js';
import { restoreSession, exportProject, loadProject, newProject, isDbAvailable } from './persistence.js';
import { renderLanding, renderMappingView, updateHeaderButtons } from './render.js';
import { initContextMenu } from './context-menu.js';
import { generateFont } from './font-generator.js';
import { branding } from './branding.js';

async function init() {
  initState();
  applyBranding();
  wireHeaderButtons();
  initContextMenu();
  const restored = await restoreSession();
  if (!isDbAvailable()) {
    const main = document.getElementById('mainArea');
    if (main) {
      const banner = document.createElement('div');
      banner.className = 'db-warning';
      banner.textContent = 'Browser storage unavailable. Use Export to save your work.';
      main.prepend(banner);
    }
  }
  if (restored) {
    renderMappingView();
    showToast('Restored previous session');
  } else {
    renderLanding();
  }
}

function wireHeaderButtons() {
  document.getElementById('btnGenerate')?.addEventListener('click', () => generateFont());
  document.getElementById('btnExport')?.addEventListener('click', () => exportProject());
  document.getElementById('btnLoad')?.addEventListener('click', () => {
    document.getElementById('projectFileInput')?.click();
  });
  document.getElementById('projectFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { await loadProject(file); renderMappingView(); }
    catch { showToast('Could not load project file.'); }
    e.target.value = '';
  });
  document.getElementById('btnNewProject')?.addEventListener('click', async () => {
    if (!confirm('Start a new project? All unsaved changes will be lost.')) return;
    await newProject();
    renderLanding();
  });
}

function applyBranding() {
  const logo = document.getElementById('headerLogo');
  if (logo && branding.logoHtml) logo.innerHTML = branding.logoHtml;

  const title = document.getElementById('headerTitle');
  if (title && branding.appName) title.textContent = branding.appName;

  const footer = document.getElementById('appFooter');
  if (footer && branding.footerHtml) {
    footer.innerHTML = branding.footerHtml;
    footer.style.display = 'flex';
  }

  document.title = branding.appName || 'Font Icon Remapper';
}

document.addEventListener('DOMContentLoaded', init);
export { showToast };
