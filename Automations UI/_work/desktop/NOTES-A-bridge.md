# NOTES-A-bridge (Task A: shell<->web bridge, network, auth)
All citations: _work/formatted-desktop/<bundle>:line  (S=sessions.desktop.main.js, W=workbench.desktop.main.js, E=extension.js)

## Origins / webUrl (PROVEN)
- S:26555-26573 product.json `linkProtectionTrustedDomains` includes https://app.devin.ai, app.beta.devin.ai, docs.devin.ai, *.devinenterprise.com, staging.itsdev.in, *.codeium.com, *.windsurf.com (W:26640 same list)
- S:1105584-1105605 `devinService` (cyi): beta env -> https://app.beta.devin.ai; quality stable/next -> https://app.devin.ai; else https://staging.itsdev.in. `devin.environment` config selects beta; codeium.apiServerUrl beta = https://server-beta.codeium.com
- S:1105606-1105620 Zct(): webapp origin = userStatus.planStatus.planInfo.devinInfo.webappHost (server-provided, http if localhost) else devinService.webUrl -> `${protocol}//${host}`
- S:1105625-1105646 auth URL helpers: `${webapp}/auth/devin/start?redirect_uri=${website}/auth/windsurf/continue&prompt=none&intent=website`; personalAnalyticsUrl override; `${website}/auth/windsurf/continue?redirect_uri=${scheme}://codeium.windsurf&prompt=select_account`
- S:1105700-1105712 iDu(): portal URL from codeium.apiServerUrl: localhost:50001->http://localhost:3001, staging->staging.itsdev.in, beta->app.beta.devin.ai, else app.devin.ai; multi_tenant uses windsurf.portalUrl

## Bridge protobuf schema `exa.desktop_bridge_pb` (PROVEN S:1538727-1539359)
Field lists (S:1538700+ relative offsets): DesktopNavItem{id,path,icon,label,min_client_version?,native_min_client_version?,beta?}; DesktopNavManifest{schema_version,revision,ttl_seconds,items[]}; DesktopHandshake{protocol_version,capabilities[],electron_version?,nonce,keyboard_forward_prefixes[],allowed_route_prefixes[]}; DesktopNavigate{path,search map<string,string>}; DesktopSetTheme{theme}; DesktopAuth{token,org_id?,user_id?}; WebPublishNav{manifest}; WebActiveRoute{path,title?,replace?,sidebar?{id,path}}; WebOpenExternal{url}; WebNavigateHost{url}; WebReady{capabilities[]}; WebRenderCrash{}; WebNavigateAck{}; WebForwardKey{event_type,key,code,key_code,alt/ctrl/meta/shift_key,repeat}; WebSidebarAction{sidebar_id,payload_json}; DesktopSidebarAction{same}; WebSidebarNavigate{path}; WebShowFind{}
Envelopes: DesktopToWebMessage oneof {handshake=1,navigate=2,set_theme=3,auth=4,sidebar_action=5} (S:1539325-1539334); WebToDesktopMessage oneof {publish_nav..navigate_host=11} (S:1539359-1539374)
## Wrapper class xqi (S:1539389-1539505)
- protocol_version _qi=7 (S:1539389); host capabilities X_a list S:1539631-1539641: navigate,activeRoute,setTheme,deliverAuth,forwardKeyboard,openExternal,publishNav,sidebarRelay,showFind
- announce() sends handshake; deliverAuth/navigate/setTheme/deliverSidebarAction gated by hasCapability (capabilities set = host options, S:1539399)
- inbound: publishNav/activeRoute/openExternal/navigateHost/sidebarAction/sidebarNavigate/showFind gated by capability; ready/renderCrash/navigateAck NOT gated (S:1539475-1539486)
- j_a default manifest revision "bundled-default" ttl 0 items [] (S:1539508); S1d item validation requires id,path,icon,label; Z9r schema validation schemaVersion>=1
- feature flags "windsurf-desktop-nav", "windsurf-desktop-nav-enterprise" (S:1539622-1539629) gate embedded nav; enterprise requires 2nd flag
## Wrapper HTML txa (S:1539645-1539718)
- vscode webview HTML with CSP: default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-X'; frame-src <origin>  (S:1539657)
- <iframe id=devin-embed-frame allow="clipboard-read; clipboard-write" sandbox="allow-scripts allow-forms allow-same-origin allow-downloads allow-popups"> (S:1539667)
- HOST_TO_WEB_KEYS ['handshake','navigate','setTheme','auth','sidebarAction'] (S:1539675)
- message listener: if event.origin===settings.origin -> forwardKey re-dispatched as KeyboardEvent, else vscode.postMessage(data). Otherwise if any host key present -> frame.contentWindow.postMessage(data, settings.origin). Checks origin only, NOT event.source (S:1539689-1539704)
- securitypolicyviolation frame-src -> postMessage {openExternal:{url}} (S:1539710-1539716)
- nxa() appends ?nonce= to webapp URL (S:1539729)

## Host webview controller Esn (S:1555340-1555690) (PROVEN)
- consts S:1555340-1555344: kxa="devin-session-token$" (token prefix), U1d="https://server.codeium.com", H1d=2e4 cold-load timeout, W1d=5e3 navigateAck timeout, UYi="/desktop-no-surfaces" (warmup path); Axa(items)= item paths + UYi = allowed_route_prefixes (S:1555345-1555347)
- _coldLoad S:1555490-1555545: resets webCapabilities; creates xqi bridge with capabilities X_a, nonce, keyboardForwardPrefixes [Meta,Control,Alt], allowedRoutePrefixes from manifest; loadTimeout 20000ms -> resolve "timeout"; onReady: store web capabilities, announce() handshake, _deliverAuth(), resolve "ready"; onPublishNav -> navManifestService.updateManifest; onOpenExternal: K_a(url, webappOrigin) detects cloud-session URL -> open in Cascade ($_a) else openerService.open external (http/https only, S:1555548-1555556)
- setHtml(txa(nxa(url,nonce))) -> wrapper HTML with iframe; url gets ?nonce=
- navigate(surface,path,warm) S:1555578-1555592: resets surface stack, bridge.navigate; if warm && web advertised "navigateAck" capability (z_a) -> 5000ms timer -> onNavigationTimeout
- _onActiveRoute S:1555602-1555619: clears nav timeout; sets title/sidebar; replace===true -> stack[cursor]=path, else push (truncating forward). NO validation of path against allowedRoutePrefixes. Fires DESKTOP_NAV_ROUTE_CHANGED analytics home/non_home (S:1555620-1555630)
- _deliverAuth S:1555647-1555653: token from _getDevinSessionToken; orgId = userStatus.planStatus.planInfo.devinInfo.orgId; userId = userStatus.userId -> bridge.deliverAuth
- _getDevinSessionToken S:1555654-1555672: if authStatus.apiKey startsWith "devin-session-token$" use directly; else Connect RPC to codeium.apiServerUrl||https://server.codeium.com with header X-Api-Key: <apiKey>, service xxa.getSelfDevinSessionToken({metadata}) -> sessionToken (must start with prefix). RPC = exa.seat_management_pb.GetSelfDevinSessionToken (S:311804-311807, S:322593). Token minting is REMOTE.
- Warmup Isn S:1555690-1555755: surface "windsurf.desktopNav.warmup"; URL built Q9r(origin, "/desktop-no-surfaces", {theme, embedded:true, embedAuth:"postmessage"}); hidden load
- Surface controller show() S:1555756-1555786: cold (load) vs warm (navigate with ack) ; recoveryMode "reload" (renderCrash S:1555706) or "remount" (fatalError / navigationTimeout S:1555719-1555721); _automaticRecoveryAttempted single auto attempt (S:1555861); load failure -> recoveryMode remount (S:1555849)
## Manifest service kqi (S:1539539-1539585) PROVEN
- storage key "windsurf.desktopNav.manifest" (application scope -1, target 1=MACHINE); updateManifest validates Z9r, stores JSON, fires change only if revision differs. ttlSeconds is parsed/stored (S:1539522,1539536) but NEVER compared to time — no expiry enforcement. Cross-window sync via storage onDidChangeValue.
- Q9r URL builder S:1538613-1538635: path resolved against webapp origin, must stay same-origin else fallback; query params theme, embedded=1, embedAuth, surfaceId
- context keys desktopNavSurfaceActive/CanGoBack/CanGoForward/SurfaceTitle (S:1538636-1538639)
## Endpoints (PROVEN via strings/rg)
- extension.js: server.codeium.com, server-beta.codeium.com, server-staging.codeium.com, inference.codeium.com, unleash.codeium.com/api/, eu.windsurf.com/_route/api_server, register.windsurf.com, app.devin.ai, app.beta.devin.ai, staging.itsdev.in, codeium-staging-exafunction.vercel.app
- sessions: + unleash.codeium.com/api/frontend, docs.devin.ai/desktop/devin-local, cli.devin.ai/docs/extensibility/mcp/overview, windsurf.com/* redirects, windsurf-stable.codeium.com, status.windsurf.com
- workbench: + marketplace.windsurf.com/vscode/{gallery,item,extensions-control}, beta.devinenterprise.com, docs.devin.ai
- CLI devin binary: api.devin.ai, app.devin.ai(/plans, /settings/usage, /settings/environment?tab=outposts), app.beta.devin.ai, cli.devin.ai/install.sh|.ps1, cli.devinenterprise.com/install, static.devin.ai/cli/current/manifest.json, static.devinenterprise.com/cli/current/manifest-enterprise.json, static.windsurf.com/cli/current/manifest-windsurfcom.json, static.devin.ai/devin-rs/remote (GATEWAY_URL Outpost), server.codeium.com (WINDSURF_API_SERVER_URL), unleash.codeium.com/api/unleash_definitions.bin; playground.watchdevinwork.com
- Language server: api.codeium.com/register_user/after, inference.codeium.com, server.codeium.com, southcentral-lb.codeium.com, unleash.codeium.com/api/experiment
- gRPC services CLI: exa.api_server_pb.ApiServerService, exa.seat_management_pb.SeatManagementService, BrowserPreviewService, ProductAnalyticsService, AttributionService
- LS services: Analytics, ApiServer, Auth, BrowserPreview, CascadePlugins, ChatClientServer, Dev, ExtensionServer, FileSystemProvider, LanguageServer, ProductAnalytics, SeatManagement, UserAnalytics
- LS auth RPCs: SeatManagementService/{CreatePKCEAuthorizationCode, ExchangePKCEAuthorizationCode, ExchangeDevinCLIPKCECode, ExchangeDevinCode, GetEligibleDevinOrganizations, GetGitHubAccessToken, GetOneTimeAuthToken, GetSelfDevinSessionToken, InvalidateDevinCaches, WindsurfPostAuth}; ApiServerService/{GetOidcAuthorizationUrl, RefreshOidcToken, GetDecagonAuthToken}; AuthService/GetUserJwt; UserAnalyticsService/GetDevinUserAnalytics
## Manifest -> surfaces (workbench bundle) PROVEN
- W:806738-806775 WAn(manifest, {protocolVersion, capabilities}): drops items with minClientVersion>protocolVersion (withheldIds); each surface {id,path,icon,label,beta,render: "web"|"native"}; render native only if host caps include "renderNative" and nativeMinClientVersion<=protocolVersion. UAn(surfaces,path): longest-prefix match on item.path
- W:806776+ iXe surface store: snapshot recomputed on manifest/unleash/auth change; disabled unless flag gate (nSe = same as S Y_a: windsurf-desktop-nav [+ -enterprise])
- Sidebar React (S:999285-999286) splits surfaces beta/non-beta; click -> executeCommand("devin.desktopNav.openSurface", {id,path}) (S:999581); command W:349993 wgn, handler W:810391-810412 -> closes editors, editorGroupsService.setActiveNavSurface(windowId,{id,path}), openView windsurfAgentSidebar
- Sessions window: EditorGroupsService._activeNavSurfaces map (S:1563730, setActiveNavSurface S:1563851); welcome view render() -> showNavSurface -> stash.ensure(editorPart) -> surface controller show(e) (S:1556311-1556383)
- NOTE: xqi supports inbound navigateHost (gated by capability) but Esn passes no onNavigateHost handler (S:1555516-1555536) -> message dropped in sessions host.
## Extension auth (E) PROVEN
- E:51191-51195 DEVIN_SESSION_TOKEN_PREFIX="devin-session-token$", isDevinSessionToken
- E:50729-50737 login URL `${website}/auth/windsurf/continue?redirect_uri=<redirectUri>&prompt=select_account&state=<id>[&login_hint]`; signup `${website}/auth/signup?...` (E:50726); manual-code fallback `${website}/auth/windsurf/show-auth-code?...intent,workflow,from=redirect` (E:50920-50930)
- E:50937-50947 handleAuthToken: string -> looksLikeCodeiumAuthToken ? codeium path (registerUser -> apiKey) : devin path; object kinds "codeium"{accessToken} | "devin"{devinCode, environment}
- E:50958-50975 handleDevinAuthToken: setWindsurfEnvironment(env); exchangeDevinCode({code}) via SeatManagementService.ExchangeDevinCode -> sessionToken must have prefix; fetchCurrentUserNameWithDevinToken -> persistSessionAndRestart
- E:51089-51121 fetchSelfDevinSessionToken(apiKey) -> GetSelfDevinSessionToken (mint from legacy codeium api key); E:49168-49200 devin-connect _ensureDevinSessionToken: use apiKey if already session token; else mint once, cache, persist STATE_IDS.PENDING_API_KEY_MIGRATION
- E:49143-49166 devin-connect _buildAuthenticatedUrl: ws URL host := planInfo.devinInfo.webappHost (ws: for localhost else wss:), query ?token=<session token minus prefix>&x-cog-org-id=<orgId>. Client caps meta cognition.ai/sessionListFolders, statelessShellReplay, lazyRepoOptions (E:49135-49142)
