const SUPABASE_URL = "https://xermoenaxdqxqetpeopu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhlcm1vZW5heGRxeHFldHBlb3B1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0ODM0ODAsImV4cCI6MjA5OTA1OTQ4MH0.PCB7pPyrai6fJLjRTBjOUTdYw-dGg5qQSG-VwAW6TCs";

// Usa localStorage para persistir sessao entre paginas e recargas
// (sessionStorage era zerado a cada navegacao — causava desconexao)
const persistentStorage = (() => {
  return {
    getItem: (key) => {
      try { return localStorage.getItem(key); } catch(e) { return null; }
    },
    setItem: (key, val) => {
      try { localStorage.setItem(key, val); } catch(e) {}
    },
    removeItem: (key) => {
      try { localStorage.removeItem(key); } catch(e) {}
    }
  };
})();

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: persistentStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Delay antes de redirecionar no SIGNED_OUT para evitar redirect
// falso durante refresh de token
let signOutTimeout = null;
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token renovado automaticamente');
    if (signOutTimeout) { clearTimeout(signOutTimeout); signOutTimeout = null; }
  }
  if (event === 'SIGNED_OUT') {
    signOutTimeout = setTimeout(() => {
      if (!window.location.pathname.includes('login')) {
        window.location.href = 'login.html';
      }
    }, 2000); // aguarda 2s antes de redirecionar
  }
});
