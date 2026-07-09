const SUPABASE_URL = "https://xermoenaxdqxqetpeopu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhlcm1vZW5heGRxeHFldHBlb3B1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0ODM0ODAsImV4cCI6MjA5OTA1OTQ4MH0.PCB7pPyrai6fJLjRTBjOUTdYw-dGg5qQSG-VwAW6TCs";

// Armazenamento de sessao em memoria (localStorage bloqueado em iframe)
const memoryStorage = (() => {
  let store = {};
  // Tenta carregar do sessionStorage (funciona fora de iframe)
  try {
    const saved = sessionStorage.getItem('sb_session');
    if (saved) store = JSON.parse(saved);
  } catch(e) {}

  return {
    getItem: (key) => {
      try { return sessionStorage.getItem(key); } catch(e) {}
      return store[key] ?? null;
    },
    setItem: (key, val) => {
      try { sessionStorage.setItem(key, val); } catch(e) {}
      store[key] = val;
    },
    removeItem: (key) => {
      try { sessionStorage.removeItem(key); } catch(e) {}
      delete store[key];
    }
  };
})();

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: memoryStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Refresh automatico ao recuperar sessao
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token renovado automaticamente');
  }
  if (event === 'SIGNED_OUT') {
    // So redireciona se nao estivermos ja na pagina de login
    if (!window.location.pathname.includes('login')) {
      window.location.href = 'login.html';
    }
  }
});
