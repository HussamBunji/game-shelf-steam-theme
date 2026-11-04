// Runs inside the Steam main window. Checks every Steam internal the theme depends on.
(async () => {
  const out = [];
  const ok = (name, pass, note = '') => out.push(`${pass ? 'OK  ' : 'FAIL'}  ${name}${note ? '  — ' + note : ''}`);
  const op = (() => { try { return window.opener; } catch (e) { return null; } })();
  ok('theme script loaded (window.__rfsShelf)', !!window.__rfsShelf, window.__rfsShelf ? 'v' + window.__rfsShelf.version : 'Millennium did not inject shelf.js');
  ok('window.opener (SharedJSContext)', !!op);
  if (!op) return out.join('\n');
  for (const g of ['appStore', 'collectionStore', 'appDetailsStore', 'SteamClient', 'SteamUIStore', 'MainWindowBrowserManager']) ok('global ' + g, !!op[g]);
  const route = op.MainWindowBrowserManager?.m_lastLocation?.pathname;
  ok('route (MainWindowBrowserManager.m_lastLocation.pathname)', typeof route === 'string', String(route));
  const col = op.collectionStore?.localGamesCollection;
  ok('collectionStore.localGamesCollection.allApps', !!col?.allApps?.length, (col?.allApps?.length || 0) + ' apps');
  const ov = (col?.allApps || []).find(a => a.app_type === 1);
  if (ov) {
    for (const f of ['appid', 'display_name', 'minutes_playtime_forever', 'rt_last_time_played', 'size_on_disk', 'm_setStoreTags']) ok('overview.' + f, f in ov);
    ok('overview.GetGameID()', typeof ov.GetGameID === 'function');
    ok('overview.BIsShortcut()', typeof ov.BIsShortcut === 'function');
    const t = (fn, ...a) => { try { return fn(...a); } catch (e) { return 'ERR ' + e.message; } };
    ok('appStore.GetCachedVerticalCapsuleURL', typeof op.appStore.GetCachedVerticalCapsuleURL === 'function', JSON.stringify(t(() => op.appStore.GetCachedVerticalCapsuleURL(ov)))?.slice(0, 90));
    try { await op.appDetailsStore.RequestAppDetails(ov.appid); } catch (e) { /* ignore */ }
    for (const f of ['GetHeroImages', 'GetLogoImages', 'GetHeaderImages', 'GetAppDetails', 'GetDescriptions']) ok('appDetailsStore.' + f, typeof op.appDetailsStore[f] === 'function');
    ok('appStore.GetLocalizationForStoreTag', typeof op.appStore.GetLocalizationForStoreTag === 'function');
  }
  ok('SteamClient.Apps.RunGame', typeof op.SteamClient?.Apps?.RunGame === 'function');
  ok('SteamClient.URL.ExecuteSteamURL', typeof op.SteamClient?.URL?.ExecuteSteamURL === 'function');
  ok('SteamUIStore.Navigate', typeof op.SteamUIStore?.Navigate === 'function');
  const skin = window.__rfsSkin;
  ok('skin.js loaded (window.__rfsSkin)', !!skin, skin ? skin.rules + ' rules' : 'Millennium did not inject src/js/skin.js');
  if (skin && skin.missing.length) ok('skin class names', false, 'not found in Steam anymore: ' + skin.missing.join(', '));
  ok('style condition active (--rf-layout)', !!getComputedStyle(document.documentElement).getPropertyValue('--rf-layout').trim());
  ok('UpdatesContainer (What\'s New anchor)', !!(window.__rfsShelf && window.__rfsShelf.SteamAPI.updatesBlock()), 'without it the shelf falls back to overlay mode');
  const panels = [...document.querySelectorAll('[class*="RightPanel"]')];
  ok('library right panel ([class*="RightPanel"])', panels.length > 0, route && route.startsWith('/library/home') ? panels.length + ' found' : 'open Library > Home to test this one');
  return out.join('\n');
})()
