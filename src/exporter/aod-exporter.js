// AOD Studio export adapter.
// This is deliberately an editor/config export, not a fabricated Zepp OS AOD API.
// Only data types with an explicit adapter mapping are marked exportable.
const AOD_EXPORT_TYPES = {
  TEXT: 'text',
  IMG: 'image',
  TIME_POINTER: 'analog-hand',
  FILL_RECT: 'shape',
  STROKE_RECT: 'shape',
  CIRCLE: 'shape',
  STROKE_CIRCLE: 'shape',
  ARC: 'shape'
};

function buildAodConfig(project) {
  const aod = project.scenes?.aod || {};
  const settings = aod.settings || {};
  const components = Array.isArray(aod.components) ? aod.components : [];
  const warnings = [];
  const objects = components.map((c) => {
    const def = REGISTRY[c.defId];
    const exportType = def ? AOD_EXPORT_TYPES[def.widgetId] : null;
    if (!exportType) warnings.push(`Объект ${c.name || c.id} (${c.defId}) сохранён в редакторе, но его экспортный тип AOD не подтверждён.`);
    return {
      id: c.id, type: exportType || 'editor-only', defId: c.defId, name: c.name,
      x: Number(c.x || 0), y: Number(c.y || 0), width: Number(c.w || 0), height: Number(c.h || 0),
      rotation: Number(c.props?.rotation || 0), scale: Number(c.props?.scale || 1),
      opacity: Number(c.props?.alpha ?? 100), visible: c.visible !== false, locked: !!c.locked,
      props: JSON.parse(JSON.stringify(c.props || {})),
      exportable: !!exportType
    };
  });
  return {
    version: 1,
    format: 'aod-studio-editor',
    device: { id: project.device?.id, name: project.device?.name, width: settings.width || project.device?.w || 480, height: settings.height || project.device?.h || 480 },
    scene: {
      background: settings.background || '#000000',
      previewMode: settings.previewMode || 'AOD',
      brightness: Number(settings.brightness ?? 100),
      showSeconds: !!settings.showSeconds,
      testTime: settings.testTime || '10:10',
      testDate: settings.testDate || '',
      sensorValues: settings.sensorValues || {}
    },
    objects,
    warnings,
    zeppOs: {
      adapterStatus: 'editor-config-only',
      message: 'This file does not claim an official Zepp OS AOD runtime API. Integrate only against APIs confirmed for the target firmware/SDK.'
    }
  };
}

function downloadAodConfig(project) {
  const cfg = buildAodConfig(project);
  const blob = new Blob([JSON.stringify(cfg, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${latinSlug(project.meta?.name || 'watchface', 'watchface')}.aod-config.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return cfg;
}
