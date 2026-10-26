/**
 * dsh-gba — Client half.
 *
 * The panel is a library list plus one detail page per cartridge; the picture
 * itself lives in a single floating window above every column. Key bindings,
 * groups and the window's opacity are persisted on the Host.
 *
 * @module dsh-gba/client
 */
window.__ModuleLoader__.load({
  id: 'dsh-gba',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const NS = 'dsh-gba';
    const PANEL_ID = 'gba-games';
    const API = '/dsh-gba/api';
    const CORE_BASE = '/dsh-gba/assets/';

    /** Show or hide the floating window (goes through the shortcut service). */
    const FLOAT_SHORTCUT = { code: 'KeyG', modifiers: ['primary', 'alt'] };

    /**
     * The boss key.
     *
     * `Ctrl+Q` is reserved by the Harness shortcut service, so this chord cannot
     * live there; the plugin keeps a local listener for it.
     */
    const BOSS_SHORTCUT = { code: 'KeyQ', modifiers: ['primary'] };

    /** GBA buttons, in the order the editors list them. */
    const BUTTONS = [
      { id: 'up', label: '↑' },
      { id: 'down', label: '↓' },
      { id: 'left', label: '←' },
      { id: 'right', label: '→' },
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'l', label: 'L' },
      { id: 'r', label: 'R' },
      { id: 'start', label: 'Start' },
      { id: 'select', label: 'Select' },
    ];

    /** The default map: WASD to move, J/K to act. */
    const DEFAULT_BINDINGS = {
      up: ['KeyW'],
      down: ['KeyS'],
      left: ['KeyA'],
      right: ['KeyD'],
      a: ['KeyK'],
      b: ['KeyJ'],
      l: ['KeyU'],
      r: ['KeyI'],
      start: ['Enter'],
      select: ['ShiftLeft', 'ShiftRight'],
    };

    /** A short label for one `KeyboardEvent.code`. */
    function keyLabel(code) {
      if (typeof code !== 'string' || code === '') return '—';
      const named = {
        ArrowUp: '↑',
        ArrowDown: '↓',
        ArrowLeft: '←',
        ArrowRight: '→',
        ShiftLeft: 'Shift',
        ShiftRight: 'Shift',
        ControlLeft: 'Ctrl',
        ControlRight: 'Ctrl',
        AltLeft: 'Alt',
        AltRight: 'Alt',
        MetaLeft: 'Meta',
        MetaRight: 'Meta',
        Space: 'Space',
        Enter: 'Enter',
        Backspace: 'Bksp',
        Escape: 'Esc',
        Tab: 'Tab',
        Minus: '-',
        Equal: '=',
        Comma: ',',
        Period: '.',
        Slash: '/',
        Semicolon: ';',
        Quote: "'",
        BracketLeft: '[',
        BracketRight: ']',
        Backslash: '\\',
        Backquote: '`',
        CapsLock: 'Caps',
        Delete: 'Del',
      };
      if (named[code] !== undefined) return named[code];
      if (/^Key[A-Z]$/.test(code)) return code.slice(3);
      if (/^Digit\d$/.test(code)) return code.slice(5);
      if (/^Numpad\d$/.test(code)) return `Num${code.slice(6)}`;
      if (/^F\d{1,2}$/.test(code)) return code;
      return code;
    }

    // #region copy
    const COPY = {
      zh: {
        panel: 'GBA 游戏',
        title: 'GBA 游戏',
        subtitle: '逛商城挑游戏，或导入自己的卡带；存档与按键都保存在本机',
        all: '全部',
        recent: '最近游玩',
        newGroup: '新建分组',
        groupName: '分组名称',
        groupEmpty: '这个分组里还没有游戏',
        groupHint: '分组会出现在上方的标签栏里，点一下即可只看这一组。',
        groupNone: '还没有分组，点右上角新建一个。',
        installed: '已安装',
        store: '在线商城',
        storeSearch: '搜索商城…',
        storeAll: '全部类型',
        storeLoading: '正在读取商城…',
        storeFailed: '商城读取失败',
        storeDownload: '下载并游玩',
        storeDownloading: '正在下载…',
        storeNoDescription: '这个作品没有提供简介。',
        about: '游戏介绍',
        lastPlayed: '上次游玩',
        groups: '分组',
        search: '搜索游戏…',
        folders: 'ROM 文件夹',
        addRom: '添加 ROM',
        emptyLibrary: '还没有游戏',
        emptyHint: '去「在线商城」挑一款，或用「添加 ROM」导入自己的 .gba。',
        noMatches: '没有匹配的游戏',
        playing: '正在运行',
        paused: '已暂停',
        booting: '正在启动…',
        loading: '正在载入…',
        failed: '启动失败',
        back: '返回游戏库',
        play: '开始游戏',
        showWindow: '显示悬浮窗',
        delete: '删除',
        saveCenter: '存档中心',
        reset: '重置卡带',
        batterySave: '游戏内存档',
        batteryMissing: '还没有内存档',
        saveNow: '写入',
        exportSave: '导出',
        importSave: '导入',
        slot: '存档位',
        empty: '空',
        save: '保存',
        load: '读取',
        clear: '清空',
        confirmDelete: '确认',
        autoSlot: '自动快照',
        autoSaved: '运行时每 30 秒自动快照一次',
        autoSaveOn: '自动保存',
        controls: '操作方式',
        controlsHint: '点按键帽后按下新键即可改键，右键或 Shift+点击可以清除。',
        resetControls: '恢复默认',
        waiting: '按键…',
        noNotes: '这个卡带没有附带说明，直接开玩吧。',
        never: '从未',
        folderTitle: 'ROM 文件夹',
        folderHint: '这些目录里的 .gba 会被加入游戏库。目录由宿主机读取，所以填写宿主机路径。',
        folderPlaceholder: '例如 D:\\Games\\GBA',
        folderAdd: '添加',
        folderRemove: '移除',
        folderScan: '重新扫描',
        folderScanning: '正在扫描…',
        folderImport: '添加',
        folderEmpty: '还没有添加任何文件夹。',
        folderDrop: '内置投放目录：{path}',
        found: '本地已找到 {count} 个卡带',
        missing: '{count} 个文件夹读不到',
        close: '关闭',
        opacity: '不透明度',
        bossKey: '老板键',
        windowHide: '隐藏（Ctrl+Q 恢复）',
        windowClose: '关闭游戏',
        windowResize: '拖动改变大小',
        shortcuts: '快捷键',
        emptyWindow: '还没有在玩的游戏',
        saved: '已保存',
        loaded: '已读取',
        cleared: '已清空',
        resetDone: '卡带已重置',
        noCore: '模拟器还没就绪，请稍后再试。',
        romTooBig: '文件超过 64 MB。',
      },
      en: {
        panel: 'GBA games',
        title: 'GBA games',
        subtitle: 'Browse the store or add your own cartridges — saves and keys stay on this machine',
        all: 'All',
        recent: 'Recently played',
        newGroup: 'New group',
        groupName: 'Group name',
        groupEmpty: 'No games in this group yet',
        groupHint: 'Groups appear as tabs above; pick one to see only that group.',
        groupNone: 'No groups yet — create one from the top right.',
        installed: 'Installed',
        store: 'Store',
        storeSearch: 'Search the store…',
        storeAll: 'All genres',
        storeLoading: 'Reading the store…',
        storeFailed: 'The store could not be read',
        storeDownload: 'Download and play',
        storeDownloading: 'Downloading…',
        storeNoDescription: 'This entry has no description.',
        about: 'About this game',
        lastPlayed: 'last played',
        groups: 'Groups',
        search: 'Search games…',
        folders: 'ROM folders',
        addRom: 'Add ROM',
        emptyLibrary: 'No games yet',
        emptyHint: 'Open the Store to pick a game, or use “Add ROM” for your own .gba files.',
        noMatches: 'No matching games',
        playing: 'Running',
        paused: 'Paused',
        booting: 'Starting…',
        loading: 'Loading…',
        failed: 'Failed to start',
        back: 'Back to library',
        play: 'Play',
        showWindow: 'Show the window',
        delete: 'Delete',
        saveCenter: 'Save Center',
        reset: 'Reset cartridge',
        batterySave: 'Battery save',
        batteryMissing: 'No battery save yet',
        saveNow: 'Write',
        exportSave: 'Export',
        importSave: 'Import',
        slot: 'Slot',
        empty: 'Empty',
        save: 'Save',
        load: 'Load',
        clear: 'Clear',
        confirmDelete: 'Confirm',
        autoSlot: 'Auto snapshot',
        autoSaved: 'Refreshed every 30 seconds while the game runs',
        autoSaveOn: 'Auto-save',
        controls: 'Controls',
        controlsHint: 'Click a key cap and press the new key; right-click or Shift+click clears it.',
        resetControls: 'Reset to defaults',
        waiting: 'Press…',
        noNotes: 'This cartridge ships without notes — just start playing.',
        never: 'never',
        folderTitle: 'ROM folders',
        folderHint: 'Cartridges in these folders join the library. The Host reads them, so these are Host paths.',
        folderPlaceholder: 'for example D:\\Games\\GBA',
        folderAdd: 'Add',
        folderRemove: 'Remove',
        folderScan: 'Rescan',
        folderScanning: 'Scanning…',
        folderImport: 'Add',
        folderEmpty: 'No folders added yet.',
        folderDrop: 'Built-in drop folder: {path}',
        found: '{count} cartridges found on disk',
        missing: '{count} folders could not be read',
        close: 'Close',
        opacity: 'Opacity',
        bossKey: 'Boss key',
        windowHide: 'Hide (Ctrl+Q restores)',
        windowClose: 'Close the game',
        windowResize: 'Drag to resize',
        shortcuts: 'Shortcuts',
        emptyWindow: 'Nothing is running yet',
        saved: 'Saved',
        loaded: 'Loaded',
        cleared: 'Cleared',
        resetDone: 'Cartridge reset',
        noCore: 'The emulator is not ready yet; try again in a moment.',
        romTooBig: 'That file is larger than 64 MB.',
      },
    };
    // #endregion

    // #region styles
    const CSS = `
.dshgba-page{width:100%;min-width:0;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6;display:flex;overflow:hidden}
.dshgba-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable;--dsh-scrollbar-width:9px;--dsh-scrollbar-thumb-border:2px}
.dshgba-col{width:100%;max-width:960px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 48px;box-sizing:border-box}
.dshgba-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:none;border-radius:var(--dsw-radius-md);cursor:pointer;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:transparent;padding:0 14px;white-space:nowrap}
.dshgba-btn:disabled{cursor:not-allowed;opacity:.4}
.dshgba-btn-md{height:36px}
.dshgba-btn-lg{height:44px;font-size:15px;padding:0 22px;border-radius:var(--dsw-radius-lg)}
.dshgba-btn-sm{height:28px;font-size:12px;line-height:18px;padding:0 10px;border-radius:var(--dsw-radius-sm)}
.dshgba-btn-primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.dshgba-btn-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.dshgba-btn-ghost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dshgba-btn-outline{border:.5px solid var(--dsw-alias-border-l3)}
.dshgba-btn-outline:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dshgba-btn-danger{color:var(--dsw-alias-state-error-primary)}
.dshgba-btn[data-active=true]{background:var(--dsw-alias-button-ghost-active-fill);box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border)}
.dshgba-btn-icon{width:28px;padding:0}
.dshgba-btn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dshgba-btn svg{flex:none}
.dshgba-bar{display:flex;align-items:center;gap:16px;padding:28px 0 16px;min-height:56px}
.dshgba-barText{flex:1;min-width:0;display:flex;flex-direction:column}
.dshgba-barText h1{margin:0;font-size:20px;font-weight:500;line-height:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgba-barText p{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-caption);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgba-barActions{flex:none;display:flex;align-items:center;gap:8px}
.dshgba-tabs{display:flex;align-items:center;overflow-x:auto;scrollbar-width:none;border-bottom:.5px solid var(--dsw-alias-border-l3);margin-bottom:14px}
.dshgba-tabs::-webkit-scrollbar{display:none}
.dshgba-tab{position:relative;flex:none;display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 2px;margin-right:20px;border:0;background:0 0;font:inherit;font-size:14px;color:var(--dsw-alias-label-tertiary);cursor:pointer;white-space:nowrap}
.dshgba-tab:hover{color:var(--dsw-alias-label-primary)}
.dshgba-tab[aria-selected=true]{color:var(--dsw-alias-label-primary);font-weight:500}
.dshgba-tab[aria-selected=true]:after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:2px;background:var(--dsw-alias-state-business-primary)}
.dshgba-tab:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px;border-radius:2px}
.dshgba-tabCount{font-size:12px;color:var(--dsw-alias-label-caption);font-weight:400}
.dshgba-tabNew{color:var(--dsw-alias-label-tertiary);cursor:pointer;display:inline-flex;align-items:center;gap:4px;height:38px;border:0;background:0 0;font:inherit;font-size:14px;white-space:nowrap}
.dshgba-tabNew:hover{color:var(--dsw-alias-label-primary)}
.dshgba-searchRow{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.dshgba-searchField{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);height:36px;border-radius:12px;display:flex;align-items:center;flex:1;min-width:0;padding:0 10px;color:var(--dsw-alias-label-tertiary);transition:border-color .15s}
.dshgba-searchField:focus-within{border-color:var(--dsw-alias-state-business-primary)}
.dshgba-searchField svg{width:14px;height:14px;flex:none}
.dshgba-searchField input{background:0 0;border:0;outline:0;flex:1;min-width:0;height:100%;padding:0 8px;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px}
.dshgba-searchField input::placeholder{color:var(--dsw-alias-label-caption)}
.dshgba-searchField input::-webkit-search-cancel-button{display:none}
.dshgba-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.dshgba-rows>li{display:block}
.dshgba-row{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;margin:0;border:0;border-radius:var(--dsw-radius-md);background:0 0;font:inherit;color:inherit;text-align:left;cursor:pointer}
.dshgba-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshgba-row:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dshgba-rowCover{flex:none;width:44px;height:44px;border-radius:8px;overflow:hidden;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2)}
.dshgba-rowCover img{width:100%;height:100%;object-fit:cover;display:block}
.dshgba-rowFallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:var(--dsw-alias-label-tertiary)}
.dshgba-rowText{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.dshgba-rowTitle{font-size:14px;font-weight:500;line-height:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgba-rowMeta{font-size:12px;line-height:18px;color:var(--dsw-alias-label-caption);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgba-rowGroups{flex:none;display:flex;gap:4px;align-items:center;max-width:42%}
.dshgba-chip{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border:0;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:16px;white-space:nowrap;cursor:pointer}
.dshgba-chip[data-active=true]{background:var(--dsw-alias-button-ghost-active-fill);color:var(--dsw-alias-label-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border)}
.dshgba-chip+:is(.dshgba-chip){margin-left:0}
.dshgba-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:56px 20px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:14px}
.dshgba-emptyGlyph{color:var(--dsw-alias-label-caption)}
.dshgba-caption{color:var(--dsw-alias-label-caption);font-size:12px;line-height:20px}
.dshgba-error{color:var(--dsw-alias-state-error-primary);font-size:12px}
.dshgba-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.dshgba-inlineForm{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dshgba-input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);height:32px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 10px;outline:0;min-width:0}
.dshgba-input:focus{border-color:var(--dsw-alias-state-business-primary)}

/* ---------- detail page ---------- */
.dshgba-detailCol{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:auto;scrollbar-gutter:stable}
.dshgba-detailInner{width:100%;max-width:960px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 56px;box-sizing:border-box;display:flex;flex-direction:column}
.dshgba-crumbRow{padding:20px 0 14px}
.dshgba-crumb{display:inline-flex;align-items:center;gap:4px}
.dshgba-titleRow{display:flex;align-items:center;gap:16px;padding-bottom:20px;border-bottom:.5px solid var(--dsw-alias-border-l3)}
.dshgba-titleCover{flex:none;width:64px;height:64px;border-radius:10px;overflow:hidden;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2)}
.dshgba-titleCover img{width:100%;height:100%;object-fit:cover;display:block}
.dshgba-titleText{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.dshgba-titleText h1{margin:0;font-size:22px;font-weight:500;line-height:30px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgba-titleMeta{display:flex;align-items:center;gap:10px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-caption);flex-wrap:wrap}
.dshgba-titleActions{flex:none;display:flex;align-items:center;gap:8px}
.dshgba-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);flex:none}
.dshgba-dot[data-on=true]{background:var(--dsw-alias-state-success-primary)}
.dshgba-block{display:flex;flex-direction:column;gap:12px;padding:24px 0;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.dshgba-block:last-of-type{border-bottom:0}
.dshgba-blockHead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.dshgba-blockHead h2{margin:0;font-size:15px;font-weight:500;line-height:22px}
.dshgba-blockHead p{margin:2px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-caption)}
.dshgba-playRow{display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap}
.dshgba-playShot{flex:none;width:232px;max-width:44%;aspect-ratio:3/2;border-radius:10px;overflow:hidden;background:#000;border:.5px solid var(--dsw-alias-border-l3)}
.dshgba-playShot img{width:100%;height:100%;object-fit:cover;display:block;image-rendering:pixelated}
.dshgba-playBody{flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:14px}
.dshgba-playNote{margin:0;font-size:13px;line-height:22px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;max-height:132px;overflow:auto}
.dshgba-playButtons{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.dshgba-saveHint{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-caption)}
.dshgba-keyGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(172px,1fr));gap:6px 14px;padding:14px 16px;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg)}
.dshgba-keyRow{display:flex;align-items:center;gap:8px;min-width:0;padding:3px 0}
.dshgba-keyName{flex:none;width:46px;font-size:12px;color:var(--dsw-alias-label-secondary);text-align:right}
.dshgba-keyCaps{flex:1;min-width:0;display:flex;gap:4px;flex-wrap:wrap}
.dshgba-keyCap{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 7px;border:.5px solid var(--dsw-alias-border-l2);border-bottom-width:1.5px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer;transition:border-color .12s}
.dshgba-keyCap:hover{border-color:var(--dsw-alias-state-business-primary)}
.dshgba-keyCap[data-waiting=true]{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.dshgba-keyCap[data-empty=true]{color:var(--dsw-alias-label-caption);border-style:dashed}
.dshgba-chipRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dshgba-kbd{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border:.5px solid var(--dsw-alias-border-l2);border-bottom-width:1.5px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;line-height:16px;white-space:nowrap}
.dshgba-shortcutRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-caption);padding-top:20px}

/* ---------- modal ---------- */
/* ---------- storefront ---------- */
.dshgba-store{display:flex;flex-direction:column}
.dshgba-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.dshgba-card{appearance:none;display:flex;flex-direction:column;gap:6px;padding:0;border:0;border-radius:var(--dsw-radius-lg);background:0 0;font:inherit;color:inherit;text-align:left;cursor:pointer}
.dshgba-card:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px}
.dshgba-cardArt{position:relative;display:block;width:100%;aspect-ratio:3/2;border-radius:var(--dsw-radius-lg);overflow:hidden;background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l3);transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
.dshgba-card:hover .dshgba-cardArt{transform:translateY(-2px);box-shadow:var(--dsw-elevation-panel,0 8px 24px rgba(0,0,0,.28));border-color:var(--dsw-alias-border-l2)}
.dshgba-cardArt img{width:100%;height:100%;object-fit:cover;display:block;image-rendering:auto}
.dshgba-cardBadge{position:absolute;left:8px;top:8px;height:20px;display:inline-flex;align-items:center;padding:0 7px;border-radius:999px;background:rgba(0,0,0,.62);color:#fff;font-size:11px;line-height:16px;backdrop-filter:blur(4px)}
.dshgba-cardTitle{font-size:13px;font-weight:500;line-height:19px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dshgba-cardMeta{font-size:12px;line-height:17px;color:var(--dsw-alias-label-caption);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgba-cardTags{display:flex;gap:4px;flex-wrap:wrap}
.dshgba-shotStrip{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}
.dshgba-shot{flex:none;width:180px;aspect-ratio:3/2;border-radius:var(--dsw-radius-md);overflow:hidden;border:.5px solid var(--dsw-alias-border-l3);background:#000}
.dshgba-shot img{width:100%;height:100%;object-fit:cover;display:block}

/* The modal follows the Harness Dialog primitive: a blurred mask over the
   frame, an elevated layer-2 panel, 24px gutters and 20px between blocks. */
.dshgba-mask{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:max(24px,var(--dsh-frame-overlay-top,24px)) 24px}
.dshgba-mask:before{content:'';position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.4));backdrop-filter:var(--dsw-mask-blur,blur(2px));animation:dshgba-fade var(--ds-transition-duration,.16s) var(--ds-ease-in-out,ease)}
@keyframes dshgba-fade{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.dshgba-mask:before,.dshgba-dialog{animation:none}}
.dshgba-dialog{position:relative;z-index:1;box-sizing:border-box;width:min(380px,100%);max-height:min(680px,88vh);display:flex;flex-direction:column;gap:20px;padding:0 0 24px;overflow:hidden;border:0;border-radius:var(--dsw-radius-panel,12px);background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1));box-shadow:var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.4));animation:dshgba-fade var(--ds-transition-duration,.16s) var(--ds-ease-in-out,ease)}
.dshgba-dialog-md{width:min(520px,100%)}
.dshgba-dialog-lg{width:min(640px,100%)}
.dshgba-dialogHead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:22px 14px 0 24px}
.dshgba-dialogHead h2{margin:0;font-size:16px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary)}
.dshgba-dialogHead p{margin:2px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dshgba-dialogClose{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary)}
.dshgba-dialogClose:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshgba-dialogBody{display:flex;flex-direction:column;gap:12px;min-width:0;padding:0 24px;overflow:auto}
.dshgba-dialogFoot{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:0 24px}
.dshgba-dialogBody:first-child{padding-top:22px}
.dshgba-dialogNotice{margin:0;padding:0 24px;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.dshgba-folderList{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.dshgba-folderItem{display:flex;align-items:center;gap:8px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);padding:6px 8px}
.dshgba-folderItem code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dshgba-slotList{display:flex;flex-direction:column;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);overflow:hidden}
.dshgba-slotRow{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.dshgba-slotRow:last-child{border-bottom:0}
.dshgba-slotName{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.dshgba-slotName b{font-weight:500;font-size:13px}
.dshgba-slotName span{font-size:11px;color:var(--dsw-alias-label-caption)}

/* ---------- floating window ---------- */
.dshgba-float{position:fixed;z-index:40;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:transparent;border:1px solid transparent;pointer-events:auto;touch-action:none;transition:background .16s ease,border-color .16s ease,box-shadow .16s ease}
.dshgba-float:hover{background:var(--dsw-alias-bg-overlay);border-color:var(--dsw-alias-border-l2);box-shadow:0 18px 48px rgba(0,0,0,.4)}
.dshgba-floatBar,.dshgba-floatFoot{opacity:0;pointer-events:none;transition:opacity .16s ease}
.dshgba-float:hover .dshgba-floatBar,.dshgba-float:hover .dshgba-floatFoot{opacity:1;pointer-events:auto}
.dshgba-floatBar{display:flex;align-items:center;gap:6px;padding:5px 6px;background:var(--dsw-alias-bg-layer-2);cursor:move;user-select:none}
.dshgba-floatTitle{flex:1;min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshgba-windowButtons{flex:none;display:flex;align-items:center;gap:2px}
.dshgba-floatBody{position:relative;width:100%;aspect-ratio:3/2;background:#000;display:flex;align-items:center;justify-content:center;border-radius:12px;overflow:hidden}
.dshgba-float:hover .dshgba-floatBody{border-radius:0}
.dshgba-floatBody canvas{width:100%;height:100%;display:block;image-rendering:pixelated;outline:none}
.dshgba-floatHint{color:#9a9a9a;font-size:12px;padding:0 12px;text-align:center}
.dshgba-floatFoot{display:flex;align-items:center;gap:2px;padding:4px 6px;background:var(--dsw-alias-bg-layer-2)}
.dshgba-floatTools{padding:8px 8px 2px;background:var(--dsw-alias-bg-layer-2)}
.dshgba-floatTools .dshgba-keyGrid{border:0;background:0 0;padding:0;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px 10px}
.dshgba-floatSlider{display:flex;align-items:center;gap:4px;margin-left:4px}
.dshgba-floatSlider input{width:62px;accent-color:var(--dsw-alias-brand-primary)}
.dshgba-floatResize{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize}
.dshgba-floatResize::after{content:'';position:absolute;right:3px;bottom:3px;width:9px;height:9px;border-right:1.5px solid var(--dsw-alias-border-l2);border-bottom:1.5px solid var(--dsw-alias-border-l2);border-radius:0 0 3px 0}

`;
    // #endregion

    // #region helpers
    async function api(path, init) {
      const response = await fetch(`${API}${path}`, { credentials: 'same-origin', ...init });
      const type = response.headers.get('content-type') ?? '';
      if (!response.ok) {
        let message = `HTTP ${String(response.status)}`;
        if (type.includes('json')) {
          try {
            const body = await response.json();
            if (typeof body?.error === 'string') message = body.error;
          } catch {
            /* keep the status text */
          }
        }
        throw new Error(message);
      }
      if (type.includes('application/json')) return response.json();
      return new Uint8Array(await response.arrayBuffer());
    }

    function formatBytes(bytes) {
      if (typeof bytes !== 'number' || bytes <= 0) return '—';
      const units = ['B', 'KB', 'MB', 'GB'];
      let value = bytes;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return `${value < 10 ? value.toFixed(1) : String(Math.round(value))} ${units[unit]}`;
    }

    function formatTime(timestamp) {
      if (typeof timestamp !== 'number' || timestamp <= 0) return '';
      try {
        return new Date(timestamp).toLocaleString();
      } catch {
        return '';
      }
    }

    function stemOf(rom) {
      return typeof rom?.stem === 'string' && rom.stem !== '' ? rom.stem : `gba-${String(rom?.id ?? 'rom').slice(0, 12)}`;
    }

    function coverUrl(rom) {
      if (typeof rom?.store === 'string' && rom.store !== '') return `${API}/store/${rom.store}/cover`;
      if (typeof rom?.artSlug === 'string' && rom.artSlug !== '') {
        return `${API}/cover/${rom.artSlug}${typeof rom.art === 'string' && rom.art !== '' ? `?art=${encodeURIComponent(rom.art)}` : ''}`;
      }
      return undefined;
    }

    function fill(text, params) {
      return text.replace(/\{(\w+)\}/g, (whole, key) => (params !== undefined && key in params ? String(params[key]) : whole));
    }

    function download(bytes, fileName, type = 'application/octet-stream') {
      const url = URL.createObjectURL(new Blob([bytes], { type }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    function installStyles() {
      if (typeof document === 'undefined') return () => {};
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-gba';
      tag.dataset.pluginCss = 'dsh-gba/player.css';
      tag.textContent = CSS;
      document.head.append(tag);
      return () => {
        tag.remove();
      };
    }

    function useEngine(engine) {
      const [, force] = useState(0);
      useEffect(() => engine.subscribe(() => force((value) => value + 1)), [engine]);
      return engine.getState();
    }

    /** A binding map with no holes. */
    function bindingsOf(settings) {
      const source = settings?.bindings ?? {};
      const out = {};
      for (const button of BUTTONS) {
        const keys = source[button.id];
        out[button.id] = Array.isArray(keys) && keys.length > 0 ? keys : DEFAULT_BINDINGS[button.id];
      }
      return out;
    }

    /** Reverse a binding map: keyboard code → GBA button. */
    function codeMap(bindings) {
      const map = new Map();
      for (const [button, keys] of Object.entries(bindings)) for (const code of keys) map.set(code, button);
      return map;
    }
    // #endregion

    // #region engine
    class Engine {
      constructor() {
        this.module = undefined;
        this.booting = undefined;
        this.canvas = undefined;
        this.holders = new Map();
        this.rom = undefined;
        this.loadedStem = undefined;
        this.fsReady = false;
        this.listeners = new Set();
        this.library = { status: 'idle', roms: [], slots: [0, 1, 2, 3, 4], autoSlot: 9 };
        this.info = undefined;
        this.store = { status: 'idle', games: [] };
        this.scan = { status: 'idle', files: [], missing: [] };
        this.settings = {
          volume: 0.55,
          fastForward: 2,
          autoSave: true,
          lastRomId: null,
          floatOpen: false,
          floatHidden: false,
          floatOpacity: 1,
          romFolders: [],
          bindings: { ...DEFAULT_BINDINGS },
          groups: {},
          groupNames: [],
        };
        this.phase = 'idle';
        this.message = undefined;
        this.error = undefined;
        this.toast = undefined;
        this.notice = undefined;
        this.busy = false;
        this.muted = false;
        this.pressed = new Set();
        this.flushTimer = undefined;
        this.autoTimer = undefined;
        this.startedAt = undefined;
        this.autoPaused = false;
        this.snapshot = undefined;
        this.t = (key) => key;
      }

      subscribe(listener) {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      }

      emit() {
        const previous = this.snapshot;
        const next = {
          phase: this.phase,
          message: this.message,
          error: this.error,
          rom: this.rom,
          muted: this.muted,
          volume: this.settings.volume,
          fastForward: this.settings.fastForward,
          autoSave: this.settings.autoSave,
          floatOpen: this.settings.floatOpen === true,
          floatHidden: this.settings.floatHidden === true,
          floatOpacity: this.settings.floatOpacity,
          bindings: this.settings.bindings,
          groups: this.settings.groups,
          groupNames: this.settings.groupNames,
          library: this.library,
          store: this.store,
          info: this.info,
          scan: this.scan,
          folders: this.settings.romFolders ?? [],
          busy: this.busy,
          toast: this.toast,
          notice: this.notice,
        };
        this.snapshot = next;
        if (previous !== undefined && Object.keys(next).every((key) => next[key] === previous[key])) return;
        for (const listener of [...this.listeners]) listener();
      }

      getState() {
        if (this.snapshot === undefined) this.emit();
        return this.snapshot;
      }

      flash(key, params) {
        const text = fill(this.t(key), params);
        this.toast = text;
        this.notice = undefined;
        this.emit();
        setTimeout(() => {
          if (this.toast === text) {
            this.toast = undefined;
            this.emit();
          }
        }, 2200);
      }

      report(message) {
        this.notice = message;
        this.toast = undefined;
        this.emit();
      }

      setStatus(phase, message, error) {
        this.phase = phase;
        this.message = message;
        this.error = error;
        this.emit();
      }

      async refresh() {
        try {
          const body = await api('/library');
          this.library = {
            status: 'ready',
            roms: Array.isArray(body.roms) ? body.roms : [],
            slots: Array.isArray(body.slots) ? body.slots : [0, 1, 2, 3, 4],
            autoSlot: typeof body.autoSlot === 'number' ? body.autoSlot : 9,
          };
          if (body.settings !== null && typeof body.settings === 'object') {
            this.settings = { ...this.settings, ...body.settings };
          }
        } catch (error) {
          this.library = { ...this.library, status: 'error' };
          this.report(error instanceof Error ? error.message : String(error));
          return;
        }
        this.emit();
      }

      /** Load the online store index once. */
      async loadStore() {
        if (this.store.status === 'ready' || this.store.status === 'loading') return;
        this.store = { status: 'loading', games: [] };
        this.emit();
        try {
          const body = await api('/store');
          const games = Array.isArray(body.games) ? body.games : [];
          this.store = { status: 'ready', games, count: typeof body.count === 'number' ? body.count : games.length };
        } catch (error) {
          this.store = { status: 'error', games: [], error: error instanceof Error ? error.message : String(error) };
        }
        this.emit();
      }

      /**
       * Download one store cartridge and add it to the library.
       *
       * The Host does the fetching and caches the bytes, so the second play of
       * the same title is instant; this only reports progress and refreshes.
       */
      async installStore(slug) {
        const body = await api(`/store/${slug}`, { method: 'POST' });
        if (body?.rom === undefined) throw new Error('the Host could not add that cartridge');
        await this.refresh();
        await this.loadStore();
        this.startGame(body.rom);
        return body.rom;
      }

      async saveSettings(patch) {
        this.settings = { ...this.settings, ...patch };
        this.emit();
        try {
          const next = await api('/settings', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(patch),
          });
          if (next !== null && typeof next === 'object') this.settings = { ...this.settings, ...next };
        } catch {
          /* preferences are best-effort */
        }
        this.emit();
      }

      async loadInfo(rom) {
        if (rom === undefined) {
          this.info = undefined;
          this.emit();
          return;
        }
        const key = rom.store ?? rom.catalogId ?? rom.id;
        if (this.info?.key === key) return;
        const base = {
          key,
          title: rom.title !== '' ? rom.title : rom.name,
          author: typeof rom.author === 'string' ? rom.author : undefined,
          shot: coverUrl(rom),
          notes: '',
        };
        this.info = base;
        this.emit();
        // The store entry carries the author's description; a sideloaded
        // cartridge has none, so the page prints its own fallback line.
        if (typeof rom.store === 'string') {
          // The description lives in the store index; a detail page opened
          // before the store finished loading must wait for it.
          if (this.store.status !== 'ready') await this.loadStore();
          const game = (this.store.games ?? []).find((entry) => entry.slug === rom.store);
          if (game !== undefined && this.info?.key === key) {
            this.info = { ...base, notes: typeof game.description === 'string' ? game.description : '' };
            this.emit();
          }
        }
      }

      async loadCore() {
        if (this.module !== undefined) return this.module;
        if (this.booting !== undefined) return this.booting;
        this.booting = (async () => {
          const { default: mGBA } = await import(`${CORE_BASE}mgba.js`);
          const canvas = this.canvas ?? document.createElement('canvas');
          canvas.width = 240;
          canvas.height = 160;
          canvas.tabIndex = 0;
          canvas.style.outline = 'none';
          canvas.style.imageRendering = 'pixelated';
          this.canvas = canvas;
          const module = await mGBA({ canvas, locateFile: (file) => `${CORE_BASE}${file}` });
          try {
            module.toggleInput(false);
          } catch {
            /* older builds */
          }
          this.module = module;
          try {
            module.setVolume(0);
          } catch {
            /* applied per game */
          }
          return module;
        })();
        try {
          return await this.booting;
        } finally {
          this.booting = undefined;
        }
      }

      async prepareFs(module) {
        if (this.fsReady === true) return;
        for (const path of ['/data', '/data/games', '/data/saves', '/data/states', '/data/screenshots', '/data/cheats', '/data/patches']) {
          try {
            module.FS.mkdir(path);
          } catch {
            /* already there */
          }
        }
        this.fsReady = true;
      }

      claim(host, priority) {
        if (this.canvas === undefined) {
          this.canvas = document.createElement('canvas');
          this.canvas.width = 240;
          this.canvas.height = 160;
          this.canvas.tabIndex = 0;
          this.canvas.style.outline = 'none';
          this.canvas.style.imageRendering = 'pixelated';
        }
        this.holders.set(host, { priority });
        this.reconcile();
        return () => {
          this.holders.delete(host);
          this.reconcile();
        };
      }

      reconcile() {
        let best;
        for (const [host, entry] of this.holders) {
          if (best === undefined || entry.priority > best.entry.priority) best = { host, entry };
        }
        if (best === undefined) {
          if (this.canvas !== undefined && this.canvas.parentNode !== null) this.canvas.parentNode.removeChild(this.canvas);
          // A boss-key hide must not pause: the next press shows the same frame.
          const hidden = this.settings.floatHidden === true && this.settings.floatOpen === true;
          if (this.phase === 'running' && hidden !== true) {
            this.autoPaused = true;
            this.pause();
          }
          this.emit();
          return;
        }
        if (this.canvas !== undefined && this.canvas.parentNode !== best.host) best.host.append(this.canvas);
        if (this.autoPaused === true && this.phase === 'paused') {
          this.autoPaused = false;
          try {
            this.module?.resumeGame();
          } catch {
            /* ignore */
          }
          this.phase = 'running';
        }
        this.emit();
      }

      readSave() {
        if (this.module === undefined || this.rom === undefined) return undefined;
        try {
          const bytes = this.module.FS.readFile(`/data/saves/${stemOf(this.rom)}.sav`);
          return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        } catch {
          return undefined;
        }
      }

      statePath(slot) {
        const direct = `/data/states/${stemOf(this.rom)}.ss${String(slot)}`;
        if (this.module === undefined) return direct;
        try {
          this.module.FS.readFile(direct);
          return direct;
        } catch {
          try {
            const suffix = `.ss${String(slot)}`;
            const names = this.module.FS.readdir('/data/states').filter((name) => name.endsWith(suffix));
            if (names.length > 0) return `/data/states/${names[names.length - 1]}`;
          } catch {
            /* no directory yet */
          }
          return direct;
        }
      }

      async flushSave() {
        if (this.rom === undefined) return;
        const bytes = this.readSave();
        if (bytes === undefined || bytes.length === 0) return;
        try {
          await api(`/roms/${this.rom.id}/save`, { method: 'PUT', body: bytes });
        } finally {
          await this.refresh();
        }
      }

      scheduleFlush() {
        if (this.flushTimer !== undefined) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => {
          this.flushTimer = undefined;
          void this.flushSave().catch(() => {});
        }, 1200);
      }

      startGame(rom) {
        if (this.busy) return;
        this.rom = rom;
        this.error = undefined;
        // Opening the window is what makes a click feel like "play".
        if (this.settings.floatOpen !== true || this.settings.floatHidden === true) {
          void this.saveSettings({ floatOpen: true, floatHidden: false });
        }
        void this.play(rom);
      }

      async play(rom) {
        if (this.busy) return;
        this.busy = true;
        this.rom = rom;
        this.error = undefined;
        this.notice = undefined;
        this.setStatus('booting', 'booting');
        try {
          const module = await this.loadCore();
          await this.prepareFs(module);
          const stem = stemOf(rom);
          if (this.loadedStem !== undefined && this.loadedStem !== stem) {
            try {
              module.pauseGame();
              module.quitGame();
            } catch {
              /* ignore */
            }
          }
          if (this.loadedStem !== stem) {
            this.setStatus('loading', 'loading');
            const romBytes = await api(`/roms/${rom.id}/rom`);
            module.FS.writeFile(`/data/games/${stem}.gba`, romBytes);
            let save;
            try {
              save = await api(`/roms/${rom.id}/save`);
            } catch {
              save = undefined;
            }
            try {
              module.FS.unlink(`/data/saves/${stem}.sav`);
            } catch {
              /* nothing to remove */
            }
            if (save !== undefined && save.length > 0) module.FS.writeFile(`/data/saves/${stem}.sav`, save);
            if (!module.loadGame(`/data/games/${stem}.gba`)) throw new Error('mGBA rejected this cartridge');
            this.loadedStem = stem;
            try {
              module.addCoreCallbacks({ saveDataUpdatedCallback: () => this.scheduleFlush() });
            } catch {
              /* older builds */
            }
            this.applyVolume();
            this.applyFastForward();
          } else {
            try {
              module.resumeGame();
            } catch {
              /* ignore */
            }
          }
          this.wakeAudio();
          this.startedAt = Date.now();
          try {
            await api(`/roms/${rom.id}/played`, { method: 'POST' });
          } catch {
            /* history is best-effort */
          }
          this.startAutoSave();
          this.setStatus('running', undefined, undefined);
          void this.refresh();
        } catch (error) {
          this.loadedStem = undefined;
          this.setStatus('error', undefined, error instanceof Error ? error.message : String(error));
        } finally {
          this.busy = false;
          this.emit();
        }
      }

      pause() {
        if (this.module === undefined || this.rom === undefined) return;
        this.releaseAll();
        try {
          this.module.pauseGame();
        } catch {
          /* ignore */
        }
        void this.flushSave().catch(() => {});
        this.setStatus('paused', undefined, undefined);
      }

      resume() {
        if (this.module === undefined || this.rom === undefined) return;
        this.autoPaused = false;
        try {
          this.module.resumeGame();
        } catch {
          /* ignore */
        }
        this.wakeAudio();
        this.setStatus('running', undefined, undefined);
      }

      async stop() {
        this.stopAutoSave();
        this.releaseAll();
        const rom = this.rom;
        const seconds = this.startedAt === undefined ? 0 : Math.round((Date.now() - this.startedAt) / 1000);
        try {
          await this.flushSave();
        } catch {
          /* keep what the Host has */
        }
        try {
          this.module?.pauseGame();
        } catch {
          /* ignore */
        }
        if (rom !== undefined && seconds > 0) {
          try {
            await api(`/roms/${rom.id}/played`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ seconds }),
            });
          } catch {
            /* best-effort */
          }
        }
        this.rom = undefined;
        this.startedAt = undefined;
        this.info = undefined;
        this.phase = 'idle';
        this.message = undefined;
        this.error = undefined;
        this.emit();
      }

      async saveSlot(slot) {
        if (this.module === undefined || this.rom === undefined) throw new Error(this.t('noCore'));
        if (!this.module.saveState(slot)) throw new Error('the core refused to save this state');
        const bytes = this.module.FS.readFile(this.statePath(slot));
        await api(`/roms/${this.rom.id}/states/${String(slot)}`, { method: 'PUT', body: bytes });
        await this.refresh();
        this.flash('saved');
      }

      async loadSlot(slot) {
        if (this.module === undefined || this.rom === undefined) throw new Error(this.t('noCore'));
        const bytes = await api(`/roms/${this.rom.id}/states/${String(slot)}`);
        this.module.FS.writeFile(this.statePath(slot), bytes);
        if (!this.module.loadState(slot)) throw new Error('the core refused to load this state');
        this.flash('loaded');
      }

      async clearSlot(slot) {
        if (this.rom === undefined) return;
        await api(`/roms/${this.rom.id}/states/${String(slot)}`, { method: 'DELETE' });
        await this.refresh();
        this.flash('cleared');
      }

      reset() {
        if (this.module === undefined || this.rom === undefined) return;
        try {
          this.module.quickReload();
        } catch {
          /* ignore */
        }
        this.flash('resetDone');
      }

      async autoSnapshot() {
        if (this.module === undefined || this.rom === undefined) return;
        try {
          const slot = this.library.autoSlot ?? 9;
          if (this.module.saveState(slot)) {
            const bytes = this.module.FS.readFile(this.statePath(slot));
            await api(`/roms/${this.rom.id}/states/${String(slot)}`, { method: 'PUT', body: bytes });
          }
          await this.flushSave();
        } catch {
          /* the next tick retries */
        }
      }

      startAutoSave() {
        this.stopAutoSave();
        this.autoTimer = setInterval(() => {
          if (this.settings.autoSave && this.phase === 'running') void this.autoSnapshot();
        }, 30000);
      }

      stopAutoSave() {
        if (this.autoTimer !== undefined) clearInterval(this.autoTimer);
        this.autoTimer = undefined;
      }

      async addRom(file) {
        if (file === undefined) return undefined;
        if (file.size > 64 * 1024 * 1024) throw new Error(this.t('romTooBig'));
        const bytes = new Uint8Array(await file.arrayBuffer());
        const body = await api(`/roms?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: bytes });
        await this.refresh();
        return body;
      }

      async deleteRom(id) {
        await api(`/roms/${id}`, { method: 'DELETE' });
        if (this.rom?.id === id) await this.stop();
        await this.refresh();
      }

      async scanFolders() {
        if (this.scan.status === 'scanning') return this.scan;
        this.scan = { ...this.scan, status: 'scanning' };
        this.emit();
        try {
          const body = await api('/scan', { method: 'POST' });
          this.scan = {
            status: 'ready',
            files: Array.isArray(body.files) ? body.files : [],
            missing: Array.isArray(body.missing) ? body.missing : [],
            folders: Array.isArray(body.folders) ? body.folders : [],
            dropFolder: typeof body.dropFolder === 'string' ? body.dropFolder : undefined,
          };
        } catch (error) {
          this.scan = { status: 'error', files: [], missing: [], error: error instanceof Error ? error.message : String(error) };
        }
        this.emit();
        return this.scan;
      }

      async importScanned(path) {
        const body = await api('/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path }),
        });
        if (body?.rom === undefined) throw new Error('the Host could not import that cartridge');
        await this.refresh();
        this.startGame(body.rom);
        return body.rom;
      }

      async addFolder(folder) {
        const folders = [...new Set([...(this.settings.romFolders ?? []), folder])].slice(-16);
        await this.saveSettings({ romFolders: folders });
        await this.scanFolders();
      }

      async removeFolder(folder) {
        const folders = (this.settings.romFolders ?? []).filter((entry) => entry !== folder);
        await this.saveSettings({ romFolders: folders });
        await this.scanFolders();
      }

      async exportSave() {
        if (this.rom === undefined) throw new Error(this.t('batteryMissing'));
        const bytes = this.readSave();
        if (bytes === undefined || bytes.length === 0) throw new Error(this.t('batteryMissing'));
        download(bytes, `${stemOf(this.rom)}.sav`);
      }

      async importSave(file) {
        if (file === undefined || this.rom === undefined) return;
        const rom = this.rom;
        const bytes = new Uint8Array(await file.arrayBuffer());
        await api(`/roms/${rom.id}/save`, { method: 'PUT', body: bytes });
        try {
          this.module?.quitGame();
        } catch {
          /* ignore */
        }
        this.loadedStem = undefined;
        await this.play(rom);
        this.flash('loaded');
      }

      press(button) {
        if (this.module === undefined || this.rom === undefined) return;
        if (this.pressed.has(button)) return;
        this.pressed.add(button);
        try {
          this.module.buttonPress(button);
        } catch {
          /* ignore */
        }
      }

      release(button) {
        this.pressed.delete(button);
        if (this.module === undefined || this.rom === undefined) return;
        try {
          this.module.buttonUnpress(button);
        } catch {
          /* ignore */
        }
      }

      releaseAll() {
        for (const button of [...this.pressed]) this.release(button);
      }

      applyVolume() {
        if (this.module === undefined) return;
        try {
          this.module.setVolume(this.muted ? 0 : this.settings.volume);
        } catch {
          /* ignore */
        }
      }

      applyFastForward() {
        if (this.module === undefined) return;
        try {
          this.module.setFastForwardMultiplier(this.settings.fastForward);
        } catch {
          /* ignore */
        }
      }

      wakeAudio() {
        try {
          const context = this.module?.SDL2?.audioContext;
          if (context !== undefined && context.state !== 'running') void context.resume();
        } catch {
          /* ignore */
        }
      }

      toggleMute() {
        this.muted = !this.muted;
        this.applyVolume();
        this.emit();
      }

      cycleFastForward() {
        const order = [1, 2, 3, 4];
        const next = order[(order.indexOf(this.settings.fastForward) + 1) % order.length];
        void this.saveSettings({ fastForward: next });
        this.applyFastForward();
        this.emit();
      }

      toggleAutoSave() {
        void this.saveSettings({ autoSave: !this.settings.autoSave });
        this.emit();
      }

      setOpacity(value) {
        void this.saveSettings({ floatOpacity: Math.max(0.35, Math.min(1, value)) });
        this.emit();
      }

      toggleFloat(open) {
        const next = open === undefined ? this.settings.floatOpen !== true : open === true;
        const patch = next ? { floatOpen: true, floatHidden: false } : { floatOpen: false };
        void this.saveSettings(patch);
        this.emit();
      }

      toggleBoss() {
        if (this.settings.floatOpen !== true) {
          void this.saveSettings({ floatOpen: true, floatHidden: false });
          this.emit();
          return;
        }
        const hidden = this.settings.floatHidden !== true;
        void this.saveSettings({ floatHidden: hidden });
        this.emit();
      }

      /** Rebind one GBA button to a new set of key codes. */
      async setBinding(button, keys) {
        const bindings = { ...bindingsOf(this.settings) };
        bindings[button] = keys.length === 0 ? DEFAULT_BINDINGS[button] : keys.slice(0, 2);
        await this.saveSettings({ bindings });
      }

      async resetBindings() {
        await this.saveSettings({ bindings: { ...DEFAULT_BINDINGS } });
      }

      /** Declare a new group name. */
      async createGroup(name) {
        const clean = name.trim().slice(0, 24);
        if (clean === '') return;
        const names = [...new Set([...(this.settings.groupNames ?? []), clean])].slice(0, 16);
        await this.saveSettings({ groupNames: names });
      }

      /** Every group name in use. */
      groupNames() {
        const declared = this.settings.groupNames ?? [];
        const used = Object.values(this.settings.groups ?? {}).flat();
        return [...new Set([...declared, ...used])].sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
      }

      /** Add or remove one ROM's membership in a group. */
      async toggleGroup(romId, name, present) {
        const groups = { ...(this.settings.groups ?? {}) };
        const current = new Set(groups[romId] ?? []);
        if (present) current.delete(name);
        else current.add(name);
        if (current.size === 0) delete groups[romId];
        else groups[romId] = [...current];
        const names = [...new Set([...(this.settings.groupNames ?? []), name])].slice(0, 16);
        await this.saveSettings({ groups, groupNames: names });
      }
    }
    // #endregion

    // #region components
    function Btn({ variant, size = 'md', disabled, onClick, title, children, icon, active, type = 'button' }) {
      const classes = ['dshgba-btn', `dshgba-btn-${size}`];
      if (variant !== undefined) classes.push(`dshgba-btn-${variant}`);
      if (icon === true) classes.push('dshgba-btn-icon');
      return h(
        'button',
        { type, className: classes.join(' '), 'data-active': active === true ? 'true' : undefined, disabled: disabled === true, onClick, title },
        children,
      );
    }

    function GamepadGlyph({ size = 16 }) {
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', fill: 'none' },
        h('path', {
          d: 'M7.2 8.5h9.6c2.1 0 3.6 1.6 3.9 3.6l.5 3.1c.2 1.4-.8 2.6-2.2 2.7-1 0-1.7-.5-2.4-1.3l-.8-1h-7.6l-.8 1c-.7.8-1.4 1.3-2.4 1.3-1.4-.1-2.4-1.3-2.2-2.7l.5-3.1c.3-2 1.8-3.6 3.9-3.6Z',
          stroke: 'currentColor',
          strokeWidth: '1.4',
          strokeLinejoin: 'round',
        }),
        h('path', { d: 'M7.6 11.4v2.6M6.3 12.7h2.6', stroke: 'currentColor', strokeWidth: '1.4', strokeLinecap: 'round' }),
        h('circle', { cx: 16.2, cy: 11.7, r: 0.95, fill: 'currentColor' }),
        h('circle', { cx: 17.9, cy: 13.4, r: 0.95, fill: 'currentColor' }),
      );
    }

    /** The dialog close glyph, matching the Harness Dialog primitive. */
    function CloseGlyph() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true', fill: 'none' },
        h('path', { d: 'm4.2 4.2 7.6 7.6M11.8 4.2l-7.6 7.6', stroke: 'currentColor', strokeWidth: '1.4', strokeLinecap: 'round' }),
      );
    }

    function SearchGlyph() {
      return h(
        'svg',
        { viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none' },
        h('circle', { cx: 10.5, cy: 10.5, r: 6.5, stroke: 'currentColor', strokeWidth: '1.6' }),
        h('path', { d: 'm15.4 15.4 4.1 4.1', stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round' }),
      );
    }

    function WindowGlyph({ kind }) {
      if (kind === 'close') {
        return h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': 'true', fill: 'none' }, h('path', { d: 'm4 4 8 8M12 4l-8 8', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }));
      }
      if (kind === 'hide') {
        return h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': 'true', fill: 'none' }, h('path', { d: 'M3 8h10', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }));
      }
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 13, height: 13, 'aria-hidden': 'true', fill: 'none' },
        h('circle', { cx: 8, cy: 8, r: 2.3, stroke: 'currentColor', strokeWidth: '1.3' }),
        h('path', { d: 'M8 2.2v1.5M8 12.3v1.5M2.2 8h1.5M12.3 8h1.5M3.9 3.9l1 1M11.1 11.1l1 1M12.1 3.9l-1 1M4.9 11.1l-1 1', stroke: 'currentColor', strokeWidth: '1.3', strokeLinecap: 'round' }),
      );
    }

    /** A cover image with a lettered fallback. */
    function Cover({ rom, large }) {
      const [broken, setBroken] = useState(false);
      const src = coverUrl(rom);
      const initial = (rom.title !== '' ? rom.title : rom.name).replace(/^(the|a|an)\s+/i, '').slice(0, 1).toUpperCase();
      return h(
        'span',
        { className: large === true ? 'dshgba-detailCover' : 'dshgba-rowCover' },
        src === undefined || broken ? h('span', { className: 'dshgba-rowFallback' }, initial) : h('img', { src, alt: '', loading: 'lazy', onError: () => setBroken(true) }),
      );
    }

    /** Keyboard handling that follows the user's binding map. */
    function useKeys(engine) {
      const state = useEngine(engine);
      const map = useMemo(() => codeMap(bindingsOf(state)), [state.bindings]);
      return useMemo(
        () => ({
          onKeyDown: (event) => {
            const button = map.get(event.code);
            if (button === undefined) return;
            event.preventDefault();
            event.stopPropagation();
            engine.press(button);
          },
          onKeyUp: (event) => {
            const button = map.get(event.code);
            if (button === undefined) return;
            event.preventDefault();
            event.stopPropagation();
            engine.release(button);
          },
          onBlur: () => engine.releaseAll(),
        }),
        [engine, map],
      );
    }

    /** One key cap; clicking it captures the next key press. */
    function BindCap({ button, index, code, onSet, onClear, t }) {
      const [waiting, setWaiting] = useState(false);
      useEffect(() => {
        if (!waiting) return undefined;
        const onKeyDown = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.code === 'Escape') {
            setWaiting(false);
            return;
          }
          onSet(button, index, event.code);
          setWaiting(false);
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [waiting, button, index, onSet]);
      return h(
        'button',
        {
          type: 'button',
          className: 'dshgba-keyCap',
          'data-waiting': waiting ? 'true' : undefined,
          'data-empty': code === undefined ? 'true' : undefined,
          title: code === undefined ? t('waiting') : keyLabel(code),
          onClick: (event) => {
            if (event.shiftKey) {
              onClear(button, index);
              return;
            }
            setWaiting((open) => !open);
          },
          onContextMenu: (event) => {
            event.preventDefault();
            onClear(button, index);
          },
        },
        waiting ? t('waiting') : code === undefined ? '+' : keyLabel(code),
      );
    }

    /** The editable control map. */
    function ControlEditor({ engine, t, compact }) {
      const state = useEngine(engine);
      const bindings = bindingsOf(state);
      const setKey = useCallback(
        (button, index, code) => {
          const next = {};
          for (const [id, keys] of Object.entries(bindings)) next[id] = keys.filter((entry) => entry !== code);
          const keys = [...(next[button] ?? [])];
          keys[index] = code;
          void engine.setBinding(
            button,
            keys.filter((entry) => entry !== undefined).slice(0, 2),
          );
        },
        [engine, bindings],
      );
      const clearKey = useCallback(
        (button, index) => {
          const keys = [...(bindings[button] ?? [])];
          keys.splice(index, 1);
          void engine.setBinding(button, keys);
        },
        [engine, bindings],
      );
      const rows = compact === true ? BUTTONS.filter((button) => ['up', 'down', 'left', 'right', 'a', 'b'].includes(button.id)) : BUTTONS;
      return h(
        'div',
        { className: 'dshgba-keyGrid' },
        rows.map((button) => {
          const keys = bindings[button.id] ?? [];
          return h(
            'div',
            { key: button.id, className: 'dshgba-keyRow' },
            h('span', { className: 'dshgba-keyName' }, button.label),
            h(
              'span',
              { className: 'dshgba-keyCaps' },
              keys.map((code, index) => h(BindCap, { key: `${button.id}-${String(index)}`, button: button.id, index, code, onSet: setKey, onClear: clearKey, t })),
              keys.length < 2 ? h(BindCap, { key: `${button.id}-add`, button: button.id, index: keys.length, code: undefined, onSet: setKey, onClear: clearKey, t }) : null,
            ),
          );
        }),
      );
    }

        /** The ROM-folder dialog. */
    function FolderDialog({ engine, t, onClose }) {
      const state = useEngine(engine);
      const [draft, setDraft] = useState('');
      const [importing, setImporting] = useState(undefined);
      const folders = state.folders ?? [];
      const scanning = state.scan?.status === 'scanning';
      useEffect(() => {
        void engine.scanFolders();
      }, [engine]);
      const add = async () => {
        const value = draft.trim();
        if (value === '') return;
        setDraft('');
        await engine.addFolder(value);
      };
      const importOne = async (path) => {
        setImporting(path);
        try {
          await engine.importScanned(path);
        } catch (error) {
          engine.report(error instanceof Error ? error.message : String(error));
        } finally {
          setImporting(undefined);
        }
      };
      return h(
        'div',
        { className: 'dshgba-mask', onPointerDown: (event) => event.target === event.currentTarget && onClose() },
        h(
          'div',
          { className: 'dshgba-dialog dshgba-dialog-md', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('folderTitle') },
          h(
            'div',
            { className: 'dshgba-dialogHead' },
            h('div', null, h('h2', null, t('folderTitle')), h('p', null, t('folderHint'))),
            h('button', { type: 'button', className: 'dshgba-dialogClose', onClick: onClose, title: t('close'), 'aria-label': t('close') }, h(CloseGlyph)),
          ),
          h(
            'div',
            { className: 'dshgba-dialogBody' },
            h(
              'div',
              { className: 'dshgba-inlineForm' },
              h('input', {
                className: 'dshgba-input',
                style: { flex: 1 },
                type: 'text',
                value: draft,
                placeholder: t('folderPlaceholder'),
                spellCheck: false,
                onChange: (event) => setDraft(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') void add();
                },
              }),
              h(Btn, { variant: 'primary', size: 'sm', disabled: draft.trim() === '', onClick: () => void add() }, t('folderAdd')),
            ),
            folders.length === 0
              ? h('p', { className: 'dshgba-caption', style: { margin: 0 } }, t('folderEmpty'))
              : h(
                  'ul',
                  { className: 'dshgba-folderList' },
                  folders.map((folder) =>
                    h(
                      'li',
                      { key: folder, className: 'dshgba-folderItem' },
                      h('code', null, folder),
                      h(Btn, { variant: 'ghost', size: 'sm', onClick: () => void engine.removeFolder(folder) }, t('folderRemove')),
                    ),
                  ),
                ),
            state.scan?.status === 'ready' && (state.scan.files ?? []).length > 0
              ? h('p', { className: 'dshgba-caption', style: { margin: 0 } }, fill(t('found'), { count: state.scan.files.length }))
              : null,
            state.scan?.status === 'ready' && (state.scan.files ?? []).length > 0
              ? h(
                  'ul',
                  { className: 'dshgba-folderList' },
                  state.scan.files.slice(0, 40).map((file) =>
                    h(
                      'li',
                      { key: file.path, className: 'dshgba-folderItem' },
                      h('code', null, file.title !== '' ? file.title : file.name),
                      h(Btn, { variant: 'outline', size: 'sm', disabled: importing === file.path, onClick: () => void importOne(file.path) }, t('folderImport')),
                    ),
                  ),
                )
              : null,
            state.scan?.status === 'ready' && typeof state.scan.dropFolder === 'string'
              ? h('p', { className: 'dshgba-caption', style: { margin: 0 } }, fill(t('folderDrop'), { path: state.scan.dropFolder }))
              : null,
            state.scan?.status === 'ready' && (state.scan.missing ?? []).length > 0
              ? h('p', { className: 'dshgba-error', style: { margin: 0 } }, fill(t('missing'), { count: state.scan.missing.length }))
              : null,
          ),
          h(
            'div',
            { className: 'dshgba-dialogFoot' },
            h(Btn, { variant: 'outline', size: 'sm', disabled: scanning, onClick: () => void engine.scanFolders() }, scanning ? t('folderScanning') : t('folderScan')),
            h(Btn, { variant: 'primary', size: 'sm', onClick: onClose }, t('close')),
          ),
        ),
      );
    }

    /** One save-state row inside the Save Center dialog. */
    function SlotRow({ engine, t, slot, record, busy, onChanged }) {
      const filled = record !== undefined && record !== null;
      const [confirming, setConfirming] = useState(false);
      const run = (action) => async () => {
        try {
          await action();
          onChanged?.();
        } catch (error) {
          engine.report(error instanceof Error ? error.message : String(error));
        }
      };
      return h(
        'div',
        { className: 'dshgba-slotRow' },
        h(
          'span',
          { className: 'dshgba-slotName' },
          h('b', null, `${t('slot')} ${String(slot + 1)}`),
          h('span', null, filled ? formatTime(record.updatedAt) : t('empty')),
        ),
        h(Btn, { size: 'sm', variant: 'ghost', disabled: busy, onClick: run(() => engine.saveSlot(slot)) }, t('save')),
        h(Btn, { size: 'sm', variant: 'ghost', disabled: busy || !filled, onClick: run(() => engine.loadSlot(slot)) }, t('load')),
        confirming
          ? h(Btn, { size: 'sm', variant: 'danger', disabled: busy, onClick: run(async () => { await engine.clearSlot(slot); setConfirming(false); }) }, t('confirmDelete'))
          : h(Btn, { size: 'sm', variant: 'ghost', disabled: busy || !filled, onClick: () => setConfirming(true) }, t('clear')),
      );
    }

    /**
     * The Save Center, as a dialog.
     *
     * It reads the cartridge it was opened for rather than "whatever is
     * running", so it works before the game starts and after it is closed —
     * which is what made the old inline panel look like a dead button.
     */
    function SaveDialog({ engine, t, rom, onClose }) {
      const state = useEngine(engine);
      const record = (state.library.roms ?? []).find((entry) => entry.id === rom.id) ?? rom;
      const fileRef = useRef(null);
      const [busy, setBusy] = useState(false);
      const [tick, setTick] = useState(0);
      const slots = state.library.slots ?? [0, 1, 2, 3, 4];
      const bySlot = new Map((record.states ?? []).map((entry) => [entry.slot, entry]));
      const guarded = (action) => async (...args) => {
        setBusy(true);
        try {
          await action(...args);
          setTick((value) => value + 1);
        } catch (error) {
          engine.report(error instanceof Error ? error.message : String(error));
        } finally {
          setBusy(false);
        }
      };
      return h(
        'div',
        { className: 'dshgba-mask', onPointerDown: (event) => event.target === event.currentTarget && onClose() },
        h(
          'div',
          { className: 'dshgba-dialog dshgba-dialog-lg', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('saveCenter'), 'data-tick': String(tick) },
          h(
            'div',
            { className: 'dshgba-dialogHead' },
            h('div', null, h('h2', null, t('saveCenter')), h('p', null, record.title !== '' ? record.title : record.name)),
            h('button', { type: 'button', className: 'dshgba-dialogClose', onClick: onClose, title: t('close'), 'aria-label': t('close') }, h(CloseGlyph)),
          ),
          h(
            'div',
            { className: 'dshgba-dialogBody' },
            h(
              'div',
              { className: 'dshgba-inlineForm', style: { justifyContent: 'space-between' } },
              h('span', { className: 'dshgba-caption' }, record.save === null || record.save === undefined ? t('batteryMissing') : `${t('batterySave')} · ${formatBytes(record.save.size)} · ${formatTime(record.save.updatedAt)}`),
              h(
                'span',
                { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
                h(
                  'label',
                  { className: 'dshgba-caption', style: { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' } },
                  h('input', { type: 'checkbox', checked: state.autoSave === true, onChange: () => engine.toggleAutoSave() }),
                  t('autoSaveOn'),
                ),
                h(Btn, { size: 'sm', variant: 'outline', disabled: busy, onClick: guarded(() => engine.flushSave()) }, t('saveNow')),
                h(Btn, { size: 'sm', variant: 'outline', disabled: busy, onClick: guarded(() => engine.exportSave()) }, t('exportSave')),
                h(Btn, { size: 'sm', variant: 'outline', disabled: busy, onClick: guarded(() => fileRef.current?.click()) }, t('importSave')),
                h('input', {
                  ref: fileRef,
                  type: 'file',
                  accept: '.sav,.srm,application/octet-stream',
                  className: 'dshgba-hidden',
                  onChange: guarded(async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    await engine.importSave(file);
                  }),
                }),
              ),
            ),
            h(
              'div',
              { className: 'dshgba-slotList' },
              slots.map((slot) => h(SlotRow, { key: slot, engine, t, slot, record: bySlot.get(slot), busy, onChanged: () => setTick((value) => value + 1) })),
            ),
            h('p', { className: 'dshgba-caption', style: { margin: 0 } }, record.auto !== null && record.auto !== undefined ? `${t('autoSlot')} · ${formatTime(record.auto.updatedAt)} · ${t('autoSaved')}` : t('autoSaved')),
          ),
          h('div', { className: 'dshgba-dialogFoot' }, h(Btn, { variant: 'primary', size: 'sm', onClick: onClose }, t('close'))),
        ),
      );
    }

    /** The “new group” dialog. */
    function GroupDialog({ engine, t, onClose, onCreated }) {
      const state = useEngine(engine);
      const [draft, setDraft] = useState('');
      const existing = engine.groupNames().filter((name) => name !== '__names');
      const create = async () => {
        const name = draft.trim();
        if (name === '') return;
        await engine.createGroup(name);
        onCreated?.(name);
        onClose();
      };
      return h(
        'div',
        { className: 'dshgba-mask', onPointerDown: (event) => event.target === event.currentTarget && onClose() },
        h(
          'div',
          { className: 'dshgba-dialog dshgba-dialog-md', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('newGroup') },
          h(
            'div',
            { className: 'dshgba-dialogHead' },
            h('div', null, h('h2', null, t('newGroup')), h('p', null, t('groupHint'))),
            h('button', { type: 'button', className: 'dshgba-dialogClose', onClick: onClose, title: t('close'), 'aria-label': t('close') }, h(CloseGlyph)),
          ),
          h(
            'div',
            { className: 'dshgba-dialogBody' },
            h('input', {
              className: 'dshgba-input',
              autoFocus: true,
              value: draft,
              placeholder: t('groupName'),
              onChange: (event) => setDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') void create();
                if (event.key === 'Escape') onClose();
              },
            }),
            existing.length === 0
              ? null
              : h(
                  'div',
                  null,
                  h('p', { className: 'dshgba-caption', style: { margin: '0 0 6px' } }, t('groups')),
                  h(
                    'div',
                    { className: 'dshgba-chipRow' },
                    existing.map((name) => h('button', { key: name, type: 'button', className: 'dshgba-chip', onClick: () => setDraft(name) }, name)),
                  ),
                ),
            state.notice === undefined ? null : h('p', { className: 'dshgba-error', style: { margin: 0 } }, state.notice),
          ),
          h(
            'div',
            { className: 'dshgba-dialogFoot' },
            h(Btn, { variant: 'outline', size: 'sm', onClick: onClose }, t('close')),
            h(Btn, { variant: 'primary', size: 'sm', disabled: draft.trim() === '', onClick: () => void create() }, t('newGroup')),
          ),
        ),
      );
    }

    /** The storefront: a browse grid over the community catalogue. */
    function StoreGrid({ engine, t, state, query, setQuery, onOpen }) {
      const store = state.store ?? { status: 'idle', games: [] };
      const [category, setCategory] = useState('all');
      const [visible, setVisible] = useState(24);
      const sentinel = useRef(null);

      const categories = useMemo(() => {
        const counts = new Map();
        for (const game of store.games ?? []) for (const name of game.categories ?? []) counts.set(name, (counts.get(name) ?? 0) + 1);
        return [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([name]) => name);
      }, [store.games]);

      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return (store.games ?? []).filter((game) => {
          if (category !== 'all' && !(game.categories ?? []).includes(category)) return false;
          if (needle === '') return true;
          return game.title.toLowerCase().includes(needle) || game.developer.toLowerCase().includes(needle);
        });
      }, [store.games, query, category]);

      useEffect(() => setVisible(24), [query, category]);

      useEffect(() => {
        const node = sentinel.current;
        if (node === null || typeof IntersectionObserver === 'undefined') return undefined;
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) setVisible((count) => Math.min(count + 24, filtered.length));
          },
          { rootMargin: '400px' },
        );
        observer.observe(node);
        return () => observer.disconnect();
      }, [filtered.length]);

      return h(
        'div',
        { className: 'dshgba-store' },
        h(
          'div',
          { className: 'dshgba-searchRow' },
          h('div', { className: 'dshgba-searchField' }, h(SearchGlyph), h('input', { type: 'search', placeholder: t('storeSearch'), value: query, onChange: (event) => setQuery(event.target.value), 'aria-label': t('storeSearch') })),
        ),
        h(
          'div',
          { className: 'dshgba-chipRow', style: { marginBottom: 14 } },
          h('button', { type: 'button', className: 'dshgba-chip', 'data-active': category === 'all', onClick: () => setCategory('all') }, t('storeAll')),
          categories.map((name) => h('button', { key: name, type: 'button', className: 'dshgba-chip', 'data-active': category === name, onClick: () => setCategory(name) }, name)),
        ),
        store.status === 'loading' || store.status === 'idle'
          ? h('div', { className: 'dshgba-empty' }, t('storeLoading'))
          : store.status === 'error'
            ? h('div', { className: 'dshgba-empty' }, h('span', null, t('storeFailed')), h('span', { className: 'dshgba-caption' }, store.error ?? ''))
            : filtered.length === 0
              ? h('div', { className: 'dshgba-empty' }, h('span', null, t('noMatches')))
              : h(
                  'div',
                  { className: 'dshgba-cards' },
                  filtered.slice(0, visible).map((game) =>
                    h(
                      'button',
                      { key: game.slug, type: 'button', className: 'dshgba-card', onClick: () => onOpen(game) },
                      h(
                        'span',
                        { className: 'dshgba-cardArt' },
                        game.cover === null ? h('span', { className: 'dshgba-rowFallback' }, game.title.slice(0, 1).toUpperCase()) : h(CardImage, { src: game.cover, alt: '' }),
                        game.installed ? h('span', { className: 'dshgba-cardBadge' }, t('installed')) : null,
                      ),
                      h('span', { className: 'dshgba-cardTitle' }, game.title),
                      h('span', { className: 'dshgba-cardMeta' }, [game.developer, formatBytes(game.size)].filter(Boolean).join(' · ')),
                      h(
                        'span',
                        { className: 'dshgba-cardTags' },
                        (game.categories ?? []).slice(0, 2).map((name) => h('span', { key: name, className: 'dshgba-chip' }, name)),
                      ),
                    ),
                  ),
                ),
        h('div', { ref: sentinel, style: { height: 1 } }),
      );
    }

    /** A card image that hides itself if the upstream art is missing. */
    function CardImage({ src, alt }) {
      const [broken, setBroken] = useState(false);
      if (broken) return h('span', { className: 'dshgba-rowFallback' }, (alt || '?').slice(0, 1).toUpperCase());
      return h('img', { src, alt: '', loading: 'lazy', onError: () => setBroken(true) });
    }

    /** One store title: the description, the screenshots and the download button. */
    function StoreDialog({ engine, t, game, onClose, onInstalled }) {
      const state = useEngine(engine);
      const [detail, setDetail] = useState(undefined);
      const [busy, setBusy] = useState(false);
      const installed = (state.library.roms ?? []).find((rom) => rom.store === game.slug);

      useEffect(() => {
        let cancelled = false;
        void (async () => {
          try {
            const body = await api(`/store/${game.slug}`);
            if (!cancelled) setDetail(body.game);
          } catch {
            /* the summary in the grid is enough */
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [game.slug]);

      const install = async () => {
        setBusy(true);
        try {
          const rom = await engine.installStore(game.slug);
          onInstalled?.(rom);
          onClose();
        } catch (error) {
          engine.report(error instanceof Error ? error.message : String(error));
        } finally {
          setBusy(false);
        }
      };

      const description = detail?.description ?? game.description;
      const shots = detail?.shots ?? [];

      return h(
        'div',
        { className: 'dshgba-mask', onPointerDown: (event) => event.target === event.currentTarget && onClose() },
        h(
          'div',
          { className: 'dshgba-dialog dshgba-dialog-lg', role: 'dialog', 'aria-modal': 'true', 'aria-label': game.title },
          h(
            'div',
            { className: 'dshgba-dialogHead' },
            h('div', null, h('h2', null, game.title), h('p', null, [game.developer, game.date, formatBytes(game.size)].filter(Boolean).join(' · '))),
            h('button', { type: 'button', className: 'dshgba-dialogClose', onClick: onClose, title: t('close'), 'aria-label': t('close') }, h(CloseGlyph)),
          ),
          h(
            'div',
            { className: 'dshgba-dialogBody' },
            shots.length > 0
              ? h(
                  'div',
                  { className: 'dshgba-shotStrip' },
                  shots.map((src) => h('span', { key: src, className: 'dshgba-shot' }, h(CardImage, { src, alt: game.title }))),
                )
              : null,
            h('p', { className: 'dshgba-dialogNotice' }, description === '' ? t('storeNoDescription') : description),
            h(
              'div',
              { className: 'dshgba-chipRow' },
              [...(game.categories ?? []), ...(game.tags ?? []).filter((tag) => !/^(event:|gba\s*jam)/i.test(tag)).slice(0, 4)].map((name) => h('span', { key: name, className: 'dshgba-chip' }, name)),
              game.event === null || game.event === undefined ? null : h('span', { className: 'dshgba-chip', 'data-active': true }, game.event),
            ),
            state.notice === undefined ? null : h('p', { className: 'dshgba-error', style: { margin: 0 } }, state.notice),
          ),
          h(
            'div',
            { className: 'dshgba-dialogFoot' },
            h(Btn, { variant: 'outline', size: 'sm', onClick: onClose }, t('close')),
            installed === undefined
              ? h(Btn, { variant: 'primary', size: 'sm', disabled: busy, onClick: () => void install() }, busy ? t('storeDownloading') : t('storeDownload'))
              : h(
                  Btn,
                  {
                    variant: 'primary',
                    size: 'sm',
                    onClick: () => {
                      engine.startGame(installed);
                      onClose();
                    },
                  },
                  t('play'),
                ),
          ),
        ),
      );
    }

    /** The library list: tabs, search, rows. */
    function Library({ engine, t, tab, setTab, query, setQuery, groups, onOpen, onFolder, onAddRom, onNewGroup, onOpenStore }) {
      const state = useEngine(engine);
      const roms = state.library.roms ?? [];

      const rows = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const titleOf = (rom) => (rom.title !== '' ? rom.title : rom.name);
        const match = (rom) => needle === '' || titleOf(rom).toLowerCase().includes(needle);
        if (tab === 'recent') {
          return [...roms].filter((rom) => rom.lastPlayedAt > 0 && match(rom)).sort((left, right) => right.lastPlayedAt - left.lastPlayedAt);
        }
        if (tab === 'all') return roms.filter(match);
        return roms.filter((rom) => (rom.groups ?? []).includes(tab)).filter(match);
      }, [roms, query, tab]);

      return h(
        'div',
        { className: 'dshgba-scroll' },
        h(
          'div',
          { className: 'dshgba-col' },
          h(
            'header',
            { className: 'dshgba-bar' },
            h('div', { className: 'dshgba-barText' }, h('h1', null, t('title')), h('p', null, t('subtitle'))),
            h(
              'div',
              { className: 'dshgba-barActions' },
              h(Btn, { variant: 'outline', size: 'md', onClick: onFolder }, t('folders')),
              h(Btn, { variant: 'primary', size: 'md', onClick: onAddRom }, t('addRom')),
            ),
          ),
          h(
            'div',
            { className: 'dshgba-tabs', role: 'tablist' },
            h('button', { type: 'button', className: 'dshgba-tab', role: 'tab', 'aria-selected': tab === 'all', onClick: () => setTab('all') }, t('all'), h('span', { className: 'dshgba-tabCount' }, String(roms.length))),
            h('button', { type: 'button', className: 'dshgba-tab', role: 'tab', 'aria-selected': tab === 'recent', onClick: () => setTab('recent') }, t('recent')),
            h('button', { type: 'button', className: 'dshgba-tab', role: 'tab', 'aria-selected': tab === 'store', onClick: () => setTab('store') }, t('store'), h('span', { className: 'dshgba-tabCount' }, String(state.store?.count ?? (state.store?.games ?? []).length))),
            groups.map((name) =>
              h(
                'button',
                { key: name, type: 'button', className: 'dshgba-tab', role: 'tab', 'aria-selected': tab === name, onClick: () => setTab(name) },
                name,
                h('span', { className: 'dshgba-tabCount' }, String(roms.filter((rom) => (rom.groups ?? []).includes(name)).length)),
              ),
            ),
            h('button', { type: 'button', className: 'dshgba-tabNew', onClick: onNewGroup }, `+ ${t('newGroup')}`),
          ),
          tab === 'store'
            ? h(StoreGrid, { engine, t, state, query, setQuery, onOpen: onOpenStore })
            : h(
            'div',
            { className: 'dshgba-searchRow' },
            h('div', { className: 'dshgba-searchField' }, h(SearchGlyph), h('input', { type: 'search', placeholder: t('search'), value: query, onChange: (event) => setQuery(event.target.value), 'aria-label': t('search') })),
          ),
          tab === 'store' ? null : rows.length === 0
            ? h(
                'div',
                { className: 'dshgba-empty' },
                h('span', { className: 'dshgba-emptyGlyph' }, h(GamepadGlyph, { size: 32 })),
                h('span', null, query.trim() !== '' ? t('noMatches') : tab === 'all' ? t('emptyLibrary') : tab === 'recent' ? t('emptyLibrary') : t('groupEmpty')),
                query.trim() === '' && tab === 'all' ? h('span', { className: 'dshgba-caption' }, t('emptyHint')) : null,
              )
            : h(
                'ul',
                { className: 'dshgba-rows' },
                rows.map((rom) =>
                  h(
                    'li',
                    { key: rom.id },
                    h(
                      'button',
                      { type: 'button', className: 'dshgba-row', onClick: () => onOpen(rom) },
                      h(Cover, { rom }),
                      h(
                        'span',
                        { className: 'dshgba-rowText' },
                        h('span', { className: 'dshgba-rowTitle' }, rom.title !== '' ? rom.title : rom.name),
                        h(
                          'span',
                          { className: 'dshgba-rowMeta' },
                          [typeof rom.author === 'string' ? rom.author : null, formatBytes(rom.size), rom.lastPlayedAt > 0 ? formatTime(rom.lastPlayedAt) : t('never')].filter(Boolean).join(' · '),
                        ),
                      ),
                      h(
                        'span',
                        { className: 'dshgba-rowGroups' },
                        (rom.groups ?? []).slice(0, 3).map((name) => h('span', { key: name, className: 'dshgba-chip' }, name)),
                      ),
                    ),
                  ),
                ),
              ),
        ),
      );
    }

    /**
     * The detail page.
     *
     * Structured like the Harness's own settings and plugin pages: a crumb, a
     * title row with the primary actions, then bordered blocks. The picture is
     * not here — it lives in the floating window — so this page is what you
     * read and configure before you play.
     */
    function Detail({ engine, t, rom, onBack, onSaveCenter, onNewGroup }) {
      const state = useEngine(engine);
      const info = state.info;
      const mine = (state.groups ?? {})[rom.id] ?? [];
      const allGroups = engine.groupNames().filter((name) => name !== '__names');
      const live = (state.library.roms ?? []).find((entry) => entry.id === rom.id) ?? rom;
      const running = state.rom?.id === rom.id;
      const [confirmDelete, setConfirmDelete] = useState(false);

      useEffect(() => {
        void engine.loadInfo(rom);
      }, [engine, rom.id]);

      const status = !running
        ? null
        : state.phase === 'error'
          ? t('failed')
          : state.phase === 'running'
            ? t('playing')
            : state.phase === 'paused'
              ? t('paused')
              : state.phase === 'booting'
                ? t('booting')
                : t('loading');

      return h(
        'div',
        { className: 'dshgba-detailCol' },
        h(
          'div',
          { className: 'dshgba-detailInner' },
          h('div', { className: 'dshgba-crumbRow' }, h('span', { className: 'dshgba-crumb' }, h(Btn, { variant: 'ghost', size: 'sm', onClick: onBack }, `← ${t('back')}`))),
          h(
            'div',
            { className: 'dshgba-titleRow' },
            h(Cover, { rom, large: true }),
            h(
              'div',
              { className: 'dshgba-titleText' },
              h('h1', null, live.title !== '' ? live.title : live.name),
              h(
                'span',
                { className: 'dshgba-titleMeta' },
                running ? h('span', { className: 'dshgba-dot', 'data-on': state.phase === 'running' }) : null,
                running ? status : formatBytes(live.size),
                typeof live.author === 'string' ? `· ${live.author}` : null,
                live.lastPlayedAt > 0 ? `· ${t('lastPlayed')} ${formatTime(live.lastPlayedAt)}` : null,
              ),
            ),
            h(
              'span',
              { className: 'dshgba-titleActions' },
              h(Btn, { variant: 'outline', size: 'md', onClick: onSaveCenter }, t('saveCenter')),
            ),
          ),
          h(
            'section',
            { className: 'dshgba-block' },
            h(
              'div',
              { className: 'dshgba-blockHead' },
              h('div', null, h('h2', null, t('about')), h('p', null, typeof live.author === 'string' ? live.author : '')),
            ),
            h(
              'div',
              { className: 'dshgba-playRow' },
              info?.shot === undefined ? null : h('span', { className: 'dshgba-playShot' }, h('img', { src: info.shot, alt: '' })),
              h(
                'div',
                { className: 'dshgba-playBody' },
                h('p', { className: 'dshgba-playNote' }, info?.notes === undefined || info.notes === '' ? t('noNotes') : info.notes),
                h(
                  'div',
                  { className: 'dshgba-playButtons' },
                  h(
                    Btn,
                    {
                      variant: 'primary',
                      size: 'lg',
                      onClick: () => {
                        if (!running) engine.startGame(live);
                        else engine.toggleFloat(true);
                      },
                    },
                    running ? t('showWindow') : t('play'),
                  ),
                  running ? h(Btn, { variant: 'outline', size: 'lg', onClick: () => engine.reset() }, t('reset')) : null,
                  confirmDelete
                    ? h(Btn, { variant: 'danger', size: 'lg', onClick: async () => { await engine.deleteRom(live.id); onBack(); } }, t('confirmDelete'))
                    : h(Btn, { variant: 'ghost', size: 'lg', onClick: () => setConfirmDelete(true) }, t('delete')),
                ),
                h(
                  'span',
                  { className: 'dshgba-saveHint' },
                  live.save === null || live.save === undefined ? t('batteryMissing') : `${t('batterySave')} · ${formatBytes(live.save.size)} · ${formatTime(live.save.updatedAt)}`,
                ),
              ),
            ),
          ),
          h(
            'section',
            { className: 'dshgba-block' },
            h(
              'div',
              { className: 'dshgba-blockHead' },
              h('div', null, h('h2', null, t('controls')), h('p', null, t('controlsHint'))),
              h(Btn, { variant: 'outline', size: 'sm', onClick: () => void engine.resetBindings() }, t('resetControls')),
            ),
            h(ControlEditor, { engine, t }),
          ),
          h(
            'section',
            { className: 'dshgba-block' },
            h(
              'div',
              { className: 'dshgba-blockHead' },
              h('div', null, h('h2', null, t('groups')), h('p', null, t('groupHint'))),
              h(Btn, { variant: 'outline', size: 'sm', onClick: onNewGroup }, `+ ${t('newGroup')}`),
            ),
            allGroups.length === 0
              ? h('p', { className: 'dshgba-caption', style: { margin: 0 } }, t('groupNone'))
              : h(
                  'div',
                  { className: 'dshgba-chipRow' },
                  allGroups.map((name) =>
                    h(
                      'button',
                      { key: name, type: 'button', className: 'dshgba-chip', 'data-active': mine.includes(name), onClick: () => void engine.toggleGroup(live.id, name, mine.includes(name)) },
                      name,
                      h('span', null, mine.includes(name) ? '×' : '+'),
                    ),
                  ),
                ),
          ),
          h(
            'p',
            { className: 'dshgba-shortcutRow' },
            h('span', null, t('shortcuts')),
            h('kbd', { className: 'dshgba-kbd' }, 'Ctrl'),
            h('kbd', { className: 'dshgba-kbd' }, 'Alt'),
            h('kbd', { className: 'dshgba-kbd' }, 'G'),
            h('span', null, t('showWindow')),
            h('kbd', { className: 'dshgba-kbd' }, 'Ctrl'),
            h('kbd', { className: 'dshgba-kbd' }, 'Q'),
            h('span', null, t('bossKey')),
          ),
          state.notice === undefined ? null : h('p', { className: 'dshgba-error' }, state.notice),
        ),
      );
    }
/** The floating window: one screen, chrome on hover, drag anywhere. */
    function FloatingPlayer({ engine, t }) {
      const state = useEngine(engine);
      const hostRef = useRef(null);
      const [position, setPosition] = useState({ x: undefined, y: undefined });
      const [size, setSize] = useState({ width: 340, height: undefined });
      const [tools, setTools] = useState(false);
      const drag = useRef(undefined);
      const resize = useRef(undefined);
      const keys = useKeys(engine);
      const rom = state.rom;
      const hidden = state.floatHidden === true;
      const open = state.floatOpen === true && hidden !== true;

      useEffect(() => {
        if (!open) return undefined;
        const host = hostRef.current;
        if (host === null) return undefined;
        return engine.claim(host, 2);
      }, [engine, open]);

      if (!open) return null;

      const isChrome = (target) => target instanceof Element && target.closest('[data-no-drag]') !== null;

      const onPointerDown = (event) => {
        if (event.button !== 0 || isChrome(event.target)) return;
        const box = hostRef.current?.closest('.dshgba-float')?.getBoundingClientRect();
        if (box === undefined) return;
        drag.current = { dx: event.clientX - box.left, dy: event.clientY - box.top };
        event.currentTarget.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event) => {
        if (drag.current === undefined) return;
        const width = size.width;
        const height = size.height ?? Math.round((width / 3) * 2);
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - width, event.clientX - drag.current.dx)),
          y: Math.max(0, Math.min(window.innerHeight - height, event.clientY - drag.current.dy)),
        });
      };
      const onPointerUp = (event) => {
        drag.current = undefined;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      };

      const onResizeDown = (event) => {
        event.stopPropagation();
        const box = hostRef.current?.closest('.dshgba-float')?.getBoundingClientRect();
        if (box === undefined) return;
        resize.current = { x: event.clientX, width: box.width };
        event.currentTarget.setPointerCapture(event.pointerId);
      };
      const onResizeMove = (event) => {
        if (resize.current === undefined) return;
        const width = Math.max(240, Math.min(900, resize.current.width + (event.clientX - resize.current.x)));
        setSize({ width, height: Math.round((width / 3) * 2) });
      };
      const onResizeUp = (event) => {
        resize.current = undefined;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      };

      const style = {
        width: `${String(size.width)}px`,
        opacity: String(state.floatOpacity ?? 1),
        left: position.x === undefined ? 'auto' : `${String(position.x)}px`,
        top: position.y === undefined ? 'auto' : `${String(position.y)}px`,
        right: position.x === undefined ? '20px' : 'auto',
        bottom: position.y === undefined ? '20px' : 'auto',
      };

      return h(
        'div',
        { className: 'dshgba-float', style, onPointerDown, onPointerMove, onPointerUp },
        h(
          'div',
          { className: 'dshgba-floatBar' },
          h(GamepadGlyph, { size: 12 }),
          h('span', { className: 'dshgba-floatTitle' }, rom === undefined ? t('title') : rom.title !== '' ? rom.title : rom.name),
          h(
            'span',
            { className: 'dshgba-windowButtons', 'data-no-drag': true },
            h(Btn, { size: 'sm', variant: 'ghost', icon: true, onClick: () => engine.toggleFloat(false), title: t('windowClose') }, h(WindowGlyph, { kind: 'close' })),
          ),
        ),
        h(
          'div',
          {
            ref: hostRef,
            className: 'dshgba-floatBody',
            tabIndex: 0,
            onKeyDown: keys.onKeyDown,
            onKeyUp: keys.onKeyUp,
            onBlur: keys.onBlur,
            style: size.height === undefined ? undefined : { height: `${String(size.height)}px`, aspectRatio: 'auto' },
          },
          rom === undefined ? h('span', { className: 'dshgba-floatHint' }, t('emptyWindow')) : null,
        ),
        tools
          ? h(
              'div',
              { className: 'dshgba-floatTools', 'data-no-drag': true },
              h(
                'div',
                { className: 'dshgba-sectionHead', style: { marginBottom: 6 } },
                h('span', { className: 'dshgba-caption' }, t('controls')),
                h(Btn, { size: 'sm', variant: 'ghost', onClick: () => void engine.resetBindings() }, t('resetControls')),
              ),
              h(ControlEditor, { engine, t, compact: true }),
            )
          : null,
        h(
          'div',
          { className: 'dshgba-floatFoot', 'data-no-drag': true },
          h(Btn, { size: 'sm', variant: 'ghost', icon: true, disabled: rom === undefined, onClick: () => (state.phase === 'running' ? engine.pause() : engine.resume()), title: state.phase === 'running' ? t('paused') : t('playing') }, state.phase === 'running' ? '⏸' : '▶'),
          h(Btn, { size: 'sm', variant: 'ghost', icon: true, disabled: rom === undefined, onClick: () => engine.cycleFastForward(), title: `⏩ ×${String(state.fastForward)}` }, '⏩'),
          h(Btn, { size: 'sm', variant: 'ghost', icon: true, disabled: rom === undefined, onClick: () => engine.toggleMute(), title: state.muted ? t('playing') : t('playing') }, state.muted ? '🔇' : '🔊'),
          h(Btn, { size: 'sm', variant: 'ghost', icon: true, onClick: () => setTools((open) => !open), active: tools === true, title: t('controls') }, h(WindowGlyph, { kind: 'gear' })),
          h(
            'label',
            { className: 'dshgba-floatSlider', title: t('opacity') },
            h('span', { className: 'dshgba-caption' }, '◐'),
            h('input', {
              type: 'range',
              min: 0.35,
              max: 1,
              step: 0.05,
              value: state.floatOpacity ?? 1,
              'aria-label': t('opacity'),
              onChange: (event) => engine.setOpacity(Number(event.target.value)),
            }),
          ),
          h('span', { style: { flex: 1 } }),
          h(Btn, { size: 'sm', variant: 'ghost', icon: true, onClick: () => engine.toggleFloat(false), title: t('windowHide') }, h(WindowGlyph, { kind: 'hide' })),
          h('span', { className: 'dshgba-resizeSlot', style: { position: 'relative', width: 0, height: 0 } }),
          h('span', { className: 'dshgba-floatResize', onPointerDown: onResizeDown, onPointerMove: onResizeMove, onPointerUp: onResizeUp, 'data-no-drag': true, title: t('windowResize') }),
        ),
      );
    }
    // #endregion

    // #region plugin
    const inject = ['slots', 'locale'];

    function apply(ctx) {
      ctx.effect(() => installStyles(), 'dsh-gba: stylesheet');
      ctx.effect(
        () =>
          ctx.locale.register(NS, {
            zh: COPY.zh,
            en: COPY.en,
          }),
        'dsh-gba: dictionaries',
      );
      const t = (key, params) => {
        const text = ctx.locale.bind(NS)(key);
        return params === undefined ? text : fill(text, params);
      };
      const engine = new Engine();
      engine.t = (key, params) => (params === undefined ? t(key) : fill(t(key), params));

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
            inject: () => ({ engine, t }),
          },
          PanelPage,
        ),
      );

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            locale: NS,
            label: () => t('panel'),
          },
          SidebarIcon,
        ),
      );

      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-gba.floating-player',
            order: 60,
            locale: NS,
            inject: () => ({ engine, t }),
          },
          FloatingPlayer,
        ),
      );

      // The show/hide toggle goes through the Harness shortcut service so it is
      // listed in its settings. The boss key cannot (Ctrl+Q is reserved), so it
      // is always a local listener.
      const toggle = () => engine.toggleFloat();
      const boss = () => engine.toggleBoss();
      let localToggle = true;
      // Guard the optional service. `ctx.inject` is applied synchronously during
      // the Harness Web boot; an unresolved requirement there leaves this entry
      // pending and aborts the whole boot, so every later client plugin
      // (@deepseek-ai/dsh-client-ui-workspace included) reports
      // `pending`/`failed` and the page shows "Failed to load plugins". The local
      // Ctrl+Alt+G listener below is a complete fallback, so check first, and
      // never let the registration failure escape apply().
      const hasShortcuts = typeof ctx.get === 'function' ? ctx.get('shortcuts') !== undefined : true;
      if (hasShortcuts) {
        try {
          ctx.inject(['shortcuts'], (scoped) => {
            try {
              scoped.effect(
                () =>
                  scoped.shortcuts.register({
                    id: 'dsh-gba.toggle-float',
                    label: () => t('showWindow'),
                    aliases: ['gba', 'floating player', 'float'],
                    defaults: {
                      'desktop:macos': FLOAT_SHORTCUT,
                      'desktop:windows': FLOAT_SHORTCUT,
                      'desktop:linux': FLOAT_SHORTCUT,
                      'web:macos': FLOAT_SHORTCUT,
                      'web:windows': FLOAT_SHORTCUT,
                    },
                    regions: ['page', 'editable'],
                    modals: [],
                    resolve: () => ({ status: 'handled', run: toggle }),
                  }),
                'dsh-gba: float shortcut',
              );
              localToggle = false;
            } catch {
              localToggle = true;
            }
          });
        } catch {
          localToggle = true;
        }
      }

      ctx.effect(() => {
        const onKeyDown = (event) => {
          if (event.isComposing) return;
          if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
          if (event.code !== BOSS_SHORTCUT.code) return;
          event.preventDefault();
          boss();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, 'dsh-gba: boss key');

      ctx.effect(() => {
        if (!localToggle) return () => {};
        const onKeyDown = (event) => {
          if (event.isComposing) return;
          if (!(event.ctrlKey || event.metaKey) || !event.altKey || event.shiftKey) return;
          if (event.code !== FLOAT_SHORTCUT.code) return;
          event.preventDefault();
          toggle();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, 'dsh-gba: toggle fallback');

      ctx.effect(
        () => () => {
          engine.stopAutoSave();
          try {
            engine.module?.pauseGame();
          } catch {
            /* going away */
          }
        },
        'dsh-gba: engine teardown',
      );
    }

    /** The panel: the library, or one cartridge's page. */
    function PanelPage({ engine, t }) {
      const state = useEngine(engine);
      const [tab, setTab] = useState('all');
      const [query, setQuery] = useState('');
      const [detailId, setDetailId] = useState(undefined);
      const [saveFor, setSaveFor] = useState(undefined);
      const [folderDialog, setFolderDialog] = useState(false);
      const [groupDialog, setGroupDialog] = useState(false);
      const [storeGame, setStoreGame] = useState(undefined);
      const fileRef = useRef(null);

      useEffect(() => {
        void engine.refresh();
        void engine.loadStore();
      }, [engine]);

      const groups = useMemo(() => engine.groupNames(), [state.groupNames, state.groups]);
      const rom = detailId === undefined ? undefined : (state.library.roms ?? []).find((entry) => entry.id === detailId);

      const addFromDisk = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file === undefined) return;
        try {
          const body = await engine.addRom(file);
          if (body?.rom !== undefined) {
            setDetailId(body.rom.id);
            engine.startGame(body.rom);
          }
        } catch (error) {
          engine.report(error instanceof Error ? error.message : String(error));
        }
      };

      return h(
        'div',
        { className: 'dshgba-page' },
        h('input', { ref: fileRef, type: 'file', accept: '.gba,.agb,.bin,application/octet-stream', className: 'dshgba-hidden', onChange: addFromDisk }),
        rom === undefined
          ? h(Library, {
              engine,
              t,
              tab,
              setTab,
              query,
              setQuery,
              groups,
              onOpen: (entry) => setDetailId(entry.id),
              onFolder: () => setFolderDialog(true),
              onAddRom: () => fileRef.current?.click(),
              onNewGroup: () => setGroupDialog(true),
              onOpenStore: (game) => setStoreGame(game),
            })
          : h(Detail, {
              engine,
              t,
              rom,
              onBack: () => setDetailId(undefined),
              onSaveCenter: () => setSaveFor(rom),
              onNewGroup: () => setGroupDialog(true),
            }),
        folderDialog ? h(FolderDialog, { engine, t, onClose: () => setFolderDialog(false) }) : null,
        groupDialog ? h(GroupDialog, { engine, t, onClose: () => setGroupDialog(false), onCreated: (name) => setTab(name) }) : null,
        saveFor === undefined ? null : h(SaveDialog, { engine, t, rom: saveFor, onClose: () => setSaveFor(undefined) }),
        storeGame === undefined
          ? null
          : h(StoreDialog, {
              engine,
              t,
              game: storeGame,
              onClose: () => setStoreGame(undefined),
              onInstalled: (rom) => setDetailId(rom.id),
            }),
      );
    }

    function SidebarIcon({ size }) {
      return h(GamepadGlyph, { size });
    }
    // #endregion

    return { inject, apply };
  },
});
