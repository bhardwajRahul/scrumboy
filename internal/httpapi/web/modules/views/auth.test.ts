// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
const showToastMock = vi.hoisted(() => vi.fn());
const redirectAfterAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../dom/elements.js", () => ({
  app: document.body,
}));

vi.mock("../api.js", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("../utils.js", () => ({
  showToast: showToastMock,
  getAppVersion: () => "",
  redirectAfterAuth: redirectAfterAuthMock,
  escapeHTML: (s: string) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;"),
}));

const enCatalog = {
  "auth.2fa.accountFallback": "your account",
  "auth.2fa.failed": "Verification failed.",
  "auth.2fa.helper": "Enter the 6-digit code from your authenticator app, or a recovery code.",
  "auth.2fa.placeholder": "Code for {account}",
  "auth.2fa.submit": "Verify",
  "auth.2fa.title": "Two-factor authentication",
  "auth.actions.bootstrap": "Bootstrap",
  "auth.actions.login": "Login",
  "auth.actions.resetPassword": "Reset Password",
  "auth.bootstrap.failed": "Setup failed.",
  "auth.bootstrap.title": "First-time setup",
  "auth.fields.confirmPassword.label": "Confirm password",
  "auth.fields.confirmPassword.placeholder": "Confirm new password",
  "auth.fields.email.placeholder": "Email",
  "auth.fields.name.placeholder": "Name",
  "auth.fields.newPassword.label": "New password",
  "auth.fields.newPassword.placeholder": "Min 8 characters",
  "auth.fields.password.placeholder": "Password",
  "auth.login.failed": "Login failed.",
  "auth.oidc.button": "Continue with SSO",
  "auth.oidc.error.email": "A verified email address is required.",
  "auth.oidc.error.generic": "Authentication failed.",
  "auth.oidc.error.provider": "The identity provider returned an error.",
  "auth.oidc.error.state_invalid": "Login session expired or invalid. Please try again.",
  "auth.oidc.error.token": "Authentication failed. Please try again.",
  "auth.password.hide": "Hide password",
  "auth.password.show": "Show password",
  "auth.reset.helper": "Enter your new password. The link expires in 30 minutes.",
  "auth.reset.invalidLink": "Invalid or missing reset link",
  "auth.reset.invalidOrExpiredToken": "Invalid or expired reset token",
  "auth.reset.passwordsMismatch": "Passwords do not match",
  "auth.reset.success": "Password reset successfully. Please log in.",
  "auth.reset.title": "Reset Password",
  "auth.shared.helper": "Authentication is enabled for this instance. Anonymous boards remain shareable by URL; durable projects require sign-in.",
  "auth.shared.or": "or",
  "auth.signIn.title": "Sign in",
  "errors.RATE_LIMITED": "Too many attempts. Try again later.",
  "errors.UNAUTHORIZED": "Unauthorized",
  "errors.generic": "Something went wrong.",
  "errors.httpStatus": "HTTP {status}",
  "settings.language.selectLabel": "Language",
} as const;

const deCatalog = {
  "auth.2fa.accountFallback": "dein Konto",
  "auth.2fa.failed": "Verifizierung fehlgeschlagen.",
  "auth.2fa.helper": "Gib den 6-stelligen Code aus deiner Authenticator-App oder einen Wiederherstellungscode ein.",
  "auth.2fa.placeholder": "Code für {account}",
  "auth.2fa.submit": "Bestätigen",
  "auth.2fa.title": "Zwei-Faktor-Authentifizierung",
  "auth.actions.bootstrap": "Einrichten",
  "auth.actions.login": "Anmelden",
  "auth.actions.resetPassword": "Passwort zurücksetzen",
  "auth.bootstrap.failed": "Einrichtung fehlgeschlagen.",
  "auth.bootstrap.title": "Ersteinrichtung",
  "auth.fields.confirmPassword.label": "Passwort bestätigen",
  "auth.fields.confirmPassword.placeholder": "Neues Passwort bestätigen",
  "auth.fields.email.placeholder": "E-Mail",
  "auth.fields.name.placeholder": "Name",
  "auth.fields.newPassword.label": "Neues Passwort",
  "auth.fields.newPassword.placeholder": "Mindestens 8 Zeichen",
  "auth.fields.password.placeholder": "Passwort",
  "auth.login.failed": "Anmeldung fehlgeschlagen.",
  "auth.oidc.button": "Mit SSO fortfahren",
  "auth.oidc.error.email": "Eine verifizierte E-Mail-Adresse ist erforderlich.",
  "auth.oidc.error.generic": "Authentifizierung fehlgeschlagen.",
  "auth.oidc.error.provider": "Der Identitätsanbieter hat einen Fehler zurückgegeben.",
  "auth.oidc.error.state_invalid": "Die Anmeldesitzung ist abgelaufen oder ungültig. Bitte versuche es erneut.",
  "auth.oidc.error.token": "Authentifizierung fehlgeschlagen. Bitte versuche es erneut.",
  "auth.password.hide": "Passwort verbergen",
  "auth.password.show": "Passwort anzeigen",
  "auth.reset.helper": "Gib dein neues Passwort ein. Der Link läuft in 30 Minuten ab.",
  "auth.reset.invalidLink": "Ungültiger oder fehlender Zurücksetzungslink",
  "auth.reset.invalidOrExpiredToken": "Ungültiger oder abgelaufener Zurücksetzungslink",
  "auth.reset.passwordsMismatch": "Passwörter stimmen nicht überein",
  "auth.reset.success": "Passwort wurde zurückgesetzt. Bitte melde dich an.",
  "auth.reset.title": "Passwort zurücksetzen",
  "auth.shared.helper": "Für diese Instanz ist die Anmeldung aktiviert. Anonyme Boards bleiben per URL teilbar; dauerhafte Projekte erfordern eine Anmeldung.",
  "auth.shared.or": "oder",
  "auth.signIn.title": "Anmelden",
  "errors.RATE_LIMITED": "Zu viele Versuche. Bitte später erneut versuchen.",
  "errors.UNAUTHORIZED": "Nicht angemeldet",
  "errors.generic": "Etwas ist schiefgelaufen.",
  "errors.httpStatus": "HTTP {status}",
  "settings.language.selectLabel": "Sprache",
} as const;

const frCatalog = {
  "auth.2fa.accountFallback": "votre compte",
  "auth.2fa.failed": "Échec de la vérification.",
  "auth.2fa.helper": "Saisissez le code à 6 chiffres de votre application d’authentification ou un code de récupération.",
  "auth.2fa.placeholder": "Code pour {account}",
  "auth.2fa.submit": "Vérifier",
  "auth.2fa.title": "Authentification à deux facteurs",
  "auth.actions.bootstrap": "Initialiser",
  "auth.actions.login": "Se connecter",
  "auth.actions.resetPassword": "Réinitialiser le mot de passe",
  "auth.bootstrap.failed": "Échec de la configuration initiale.",
  "auth.bootstrap.title": "Configuration initiale",
  "auth.fields.confirmPassword.label": "Confirmer le mot de passe",
  "auth.fields.confirmPassword.placeholder": "Confirmer le nouveau mot de passe",
  "auth.fields.email.placeholder": "E-mail",
  "auth.fields.name.placeholder": "Nom",
  "auth.fields.newPassword.label": "Nouveau mot de passe",
  "auth.fields.newPassword.placeholder": "8 caractères minimum",
  "auth.fields.password.placeholder": "Mot de passe",
  "auth.login.failed": "Échec de la connexion.",
  "auth.oidc.button": "Continuer avec le SSO",
  "auth.oidc.error.email": "Une adresse e-mail vérifiée est requise.",
  "auth.oidc.error.generic": "L’authentification a échoué.",
  "auth.oidc.error.provider": "Le fournisseur d’identité a renvoyé une erreur.",
  "auth.oidc.error.state_invalid": "La session de connexion a expiré ou est invalide. Veuillez réessayer.",
  "auth.oidc.error.token": "L’authentification a échoué. Veuillez réessayer.",
  "auth.password.hide": "Masquer le mot de passe",
  "auth.password.show": "Afficher le mot de passe",
  "auth.reset.helper": "Saisissez votre nouveau mot de passe. Le lien expire dans 30 minutes.",
  "auth.reset.invalidLink": "Lien de réinitialisation invalide ou manquant",
  "auth.reset.invalidOrExpiredToken": "Lien de réinitialisation invalide ou expiré",
  "auth.reset.passwordsMismatch": "Les mots de passe ne correspondent pas",
  "auth.reset.success": "Mot de passe réinitialisé avec succès. Veuillez vous connecter.",
  "auth.reset.title": "Réinitialiser le mot de passe",
  "auth.shared.helper": "L’authentification est activée pour cette instance. Les tableaux anonymes restent partageables par URL ; les projets persistants nécessitent une connexion.",
  "auth.shared.or": "ou",
  "auth.signIn.title": "Se connecter",
  "errors.RATE_LIMITED": "Trop de tentatives. Réessayez plus tard.",
  "errors.UNAUTHORIZED": "Connexion requise",
  "errors.generic": "Une erreur s’est produite.",
  "errors.httpStatus": "HTTP {status}",
  "settings.language.selectLabel": "Langue",
} as const;

const ptCatalog = {
  "auth.2fa.accountFallback": "sua conta",
  "auth.2fa.failed": "Falha na verificação.",
  "auth.2fa.helper": "Digite o código de 6 dígitos do seu aplicativo autenticador ou um código de recuperação.",
  "auth.2fa.placeholder": "Código para {account}",
  "auth.2fa.submit": "Verificar",
  "auth.2fa.title": "Autenticação de dois fatores",
  "auth.actions.bootstrap": "Configurar",
  "auth.actions.login": "Entrar",
  "auth.actions.resetPassword": "Redefinir senha",
  "auth.bootstrap.failed": "Falha na configuração inicial.",
  "auth.bootstrap.title": "Configuração inicial",
  "auth.fields.confirmPassword.label": "Confirmar senha",
  "auth.fields.confirmPassword.placeholder": "Confirme a nova senha",
  "auth.fields.email.placeholder": "E-mail",
  "auth.fields.name.placeholder": "Nome",
  "auth.fields.newPassword.label": "Nova senha",
  "auth.fields.newPassword.placeholder": "Mínimo de 8 caracteres",
  "auth.fields.password.placeholder": "Senha",
  "auth.login.failed": "Falha no login.",
  "auth.oidc.button": "Continuar com SSO",
  "auth.oidc.error.email": "É necessário um endereço de e-mail verificado.",
  "auth.oidc.error.generic": "A autenticação falhou.",
  "auth.oidc.error.provider": "O provedor de identidade retornou um erro.",
  "auth.oidc.error.state_invalid": "A sessão de login expirou ou é inválida. Tente novamente.",
  "auth.oidc.error.token": "A autenticação falhou. Tente novamente.",
  "auth.password.hide": "Ocultar senha",
  "auth.password.show": "Mostrar senha",
  "auth.reset.helper": "Digite sua nova senha. O link expira em 30 minutos.",
  "auth.reset.invalidLink": "Link de redefinição inválido ou ausente",
  "auth.reset.invalidOrExpiredToken": "Link de redefinição inválido ou expirado",
  "auth.reset.passwordsMismatch": "As senhas não coincidem",
  "auth.reset.success": "Senha redefinida com sucesso. Faça login.",
  "auth.reset.title": "Redefinir senha",
  "auth.shared.helper": "A autenticação está ativada nesta instância. Quadros anônimos continuam compartilháveis por URL; projetos permanentes exigem login.",
  "auth.shared.or": "ou",
  "auth.signIn.title": "Entrar",
  "errors.RATE_LIMITED": "Muitas tentativas. Tente novamente mais tarde.",
  "errors.UNAUTHORIZED": "Login necessário",
  "errors.generic": "Algo deu errado.",
  "errors.httpStatus": "HTTP {status}",
  "settings.language.selectLabel": "Idioma",
} as const;

const arCatalog = {
  "auth.2fa.accountFallback": "حسابك",
  "auth.2fa.failed": "فشل التحقق.",
  "auth.2fa.helper": "أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة، أو رمز استرداد.",
  "auth.2fa.placeholder": "رمز {account}",
  "auth.2fa.submit": "تحقق",
  "auth.2fa.title": "المصادقة الثنائية",
  "auth.actions.bootstrap": "إعداد أولي",
  "auth.actions.login": "تسجيل الدخول",
  "auth.actions.resetPassword": "إعادة تعيين كلمة المرور",
  "auth.bootstrap.failed": "فشل الإعداد.",
  "auth.bootstrap.title": "الإعداد لأول مرة",
  "auth.fields.confirmPassword.label": "تأكيد كلمة المرور",
  "auth.fields.confirmPassword.placeholder": "تأكيد كلمة المرور الجديدة",
  "auth.fields.email.placeholder": "البريد الإلكتروني",
  "auth.fields.name.placeholder": "الاسم",
  "auth.fields.newPassword.label": "كلمة مرور جديدة",
  "auth.fields.newPassword.placeholder": "8 أحرف على الأقل",
  "auth.fields.password.placeholder": "كلمة المرور",
  "auth.login.failed": "فشل تسجيل الدخول.",
  "auth.oidc.button": "المتابعة عبر SSO",
  "auth.oidc.error.email": "يلزم عنوان بريد إلكتروني موثّق.",
  "auth.oidc.error.generic": "فشلت المصادقة.",
  "auth.oidc.error.provider": "أعاد مزوّد الهوية خطأ.",
  "auth.oidc.error.state_invalid": "انتهت صلاحية جلسة تسجيل الدخول أو أنها غير صالحة. يرجى المحاولة مرة أخرى.",
  "auth.oidc.error.token": "فشلت المصادقة. يرجى المحاولة مرة أخرى.",
  "auth.password.hide": "إخفاء كلمة المرور",
  "auth.password.show": "إظهار كلمة المرور",
  "auth.reset.helper": "أدخل كلمة المرور الجديدة. ينتهي الرابط خلال 30 دقيقة.",
  "auth.reset.invalidLink": "رابط إعادة التعيين غير صالح أو مفقود",
  "auth.reset.invalidOrExpiredToken": "رمز إعادة التعيين غير صالح أو منتهٍ",
  "auth.reset.passwordsMismatch": "كلمتا المرور غير متطابقتين",
  "auth.reset.success": "تمت إعادة تعيين كلمة المرور بنجاح. يرجى تسجيل الدخول.",
  "auth.reset.title": "إعادة تعيين كلمة المرور",
  "auth.shared.helper": "المصادقة مفعّلة لهذه النسخة. تبقى اللوحات المجهولة قابلة للمشاركة عبر الرابط؛ المشاريع الدائمة تتطلب تسجيل الدخول.",
  "auth.shared.or": "أو",
  "auth.signIn.title": "تسجيل الدخول",
  "errors.RATE_LIMITED": "محاولات كثيرة جداً. حاول مرة أخرى لاحقاً.",
  "errors.UNAUTHORIZED": "غير مصرّح",
  "errors.generic": "حدث خطأ ما.",
  "errors.httpStatus": "HTTP {status}",
  "settings.language.selectLabel": "اللغة",
} as const;

const ruCatalog = {
  "auth.2fa.accountFallback": "ваш аккаунт",
  "auth.2fa.failed": "Проверка не удалась.",
  "auth.2fa.helper": "Введите 6-значный код из приложения-аутентификатора или код восстановления.",
  "auth.2fa.placeholder": "Код для {account}",
  "auth.2fa.submit": "Проверить",
  "auth.2fa.title": "Двухфакторная аутентификация",
  "auth.actions.bootstrap": "Настройка",
  "auth.actions.login": "Войти",
  "auth.actions.resetPassword": "Сбросить пароль",
  "auth.bootstrap.failed": "Настройка не удалась.",
  "auth.bootstrap.title": "Первоначальная настройка",
  "auth.fields.confirmPassword.label": "Подтвердите пароль",
  "auth.fields.confirmPassword.placeholder": "Подтвердите новый пароль",
  "auth.fields.email.placeholder": "Email",
  "auth.fields.name.placeholder": "Имя",
  "auth.fields.newPassword.label": "Новый пароль",
  "auth.fields.newPassword.placeholder": "Минимум 8 символов",
  "auth.fields.password.placeholder": "Пароль",
  "auth.login.failed": "Вход не удался.",
  "auth.oidc.button": "Продолжить через SSO",
  "auth.oidc.error.email": "Требуется подтверждённый адрес email.",
  "auth.oidc.error.generic": "Аутентификация не удалась.",
  "auth.oidc.error.provider": "Провайдер идентификации вернул ошибку.",
  "auth.oidc.error.state_invalid": "Сессия входа истекла или недействительна. Попробуйте снова.",
  "auth.oidc.error.token": "Аутентификация не удалась. Попробуйте снова.",
  "auth.password.hide": "Скрыть пароль",
  "auth.password.show": "Показать пароль",
  "auth.reset.helper": "Введите новый пароль. Ссылка действует 30 минут.",
  "auth.reset.invalidLink": "Недействительная или отсутствующая ссылка сброса",
  "auth.reset.invalidOrExpiredToken": "Недействительный или просроченный токен сброса",
  "auth.reset.passwordsMismatch": "Пароли не совпадают",
  "auth.reset.success": "Пароль успешно сброшен. Войдите в систему.",
  "auth.reset.title": "Сброс пароля",
  "auth.shared.helper": "Для этого экземпляра включена аутентификация. Анонимные доски остаются доступными по URL; постоянные проекты требуют входа.",
  "auth.shared.or": "или",
  "auth.signIn.title": "Вход",
  "errors.RATE_LIMITED": "Слишком много попыток. Попробуйте позже.",
  "errors.UNAUTHORIZED": "Не авторизован",
  "errors.generic": "Что-то пошло не так.",
  "errors.httpStatus": "HTTP {status}",
  "settings.language.selectLabel": "Язык",
} as const;

const pseudoCatalog = {
  "auth.2fa.accountFallback": "[!! your account !!]",
  "auth.2fa.failed": "[!! Verification failed. !!]",
  "auth.2fa.helper": "[!! Enter the 6-digit code from your authenticator app, or a recovery code. !!]",
  "auth.2fa.placeholder": "[!! Code for {account} !!]",
  "auth.2fa.submit": "[!! Verify !!]",
  "auth.2fa.title": "[!! Two-factor authentication !!]",
  "auth.actions.bootstrap": "[!! Bootstrap !!]",
  "auth.actions.login": "[!! Login !!]",
  "auth.actions.resetPassword": "[!! Reset Password !!]",
  "auth.bootstrap.failed": "[!! Setup failed. !!]",
  "auth.bootstrap.title": "[!! First-time setup !!]",
  "auth.fields.confirmPassword.label": "[!! Confirm password !!]",
  "auth.fields.confirmPassword.placeholder": "[!! Confirm new password !!]",
  "auth.fields.email.placeholder": "[!! Email !!]",
  "auth.fields.name.placeholder": "[!! Name !!]",
  "auth.fields.newPassword.label": "[!! New password !!]",
  "auth.fields.newPassword.placeholder": "[!! Min 8 characters !!]",
  "auth.fields.password.placeholder": "[!! Password !!]",
  "auth.login.failed": "[!! Login failed. !!]",
  "auth.oidc.button": "[!! Continue with SSO !!]",
  "auth.oidc.error.email": "[!! A verified email address is required. !!]",
  "auth.oidc.error.generic": "[!! Authentication failed. !!]",
  "auth.oidc.error.provider": "[!! The identity provider returned an error. !!]",
  "auth.oidc.error.state_invalid": "[!! Login session expired or invalid. Please try again. !!]",
  "auth.oidc.error.token": "[!! Authentication failed. Please try again. !!]",
  "auth.password.hide": "[!! Hide password !!]",
  "auth.password.show": "[!! Show password !!]",
  "auth.reset.helper": "[!! Enter your new password. The link expires in 30 minutes. !!]",
  "auth.reset.invalidLink": "[!! Invalid or missing reset link !!]",
  "auth.reset.invalidOrExpiredToken": "[!! Invalid or expired reset token !!]",
  "auth.reset.passwordsMismatch": "[!! Passwords do not match !!]",
  "auth.reset.success": "[!! Password reset successfully. Please log in. !!]",
  "auth.reset.title": "[!! Reset Password !!]",
  "auth.shared.helper": "[!! Authentication is enabled for this instance. Anonymous boards remain shareable by URL; durable projects require sign-in. !!]",
  "auth.shared.or": "[!! or !!]",
  "auth.signIn.title": "[!! Sign in !!]",
  "errors.RATE_LIMITED": "[!! Too many attempts. Try again later. !!]",
  "errors.UNAUTHORIZED": "[!! Unauthorized !!]",
  "errors.generic": "[!! Something went wrong. !!]",
  "errors.httpStatus": "[!! HTTP {status} !!]",
  "settings.language.selectLabel": "[!! Language !!]",
} as const;

type TestLocale = "en" | "de" | "fr" | "pt" | "ar" | "ru" | "pseudo";

function loader() {
  return vi.fn(async (locale: TestLocale) => {
    const catalogs = {
      en: enCatalog,
      de: deCatalog,
      fr: frCatalog,
      pt: ptCatalog,
      ar: arCatalog,
      ru: ruCatalog,
      pseudo: pseudoCatalog,
    };
    return catalogs[locale];
  });
}

async function setupI18n(locale: TestLocale = "en") {
  const i18n = await import("../i18n/index.js");
  await i18n.initI18n({
    locale,
    loadLocale: loader(),
  });
  return i18n;
}

async function flushPromises(count = 8): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

function getAuthLocaleSelect(): HTMLButtonElement {
  const button = document.getElementById("authLocaleSelect") as HTMLButtonElement | null;
  if (!button) throw new Error("missing auth locale selector");
  return button;
}

function authLocaleOptionDetails(): Array<{ locale: string; label: string; flagSrc: string }> {
  const list = getAuthLocaleSelect().closest(".locale-picker")?.querySelector(".locale-picker__list");
  return Array.from(list?.querySelectorAll('[role="option"]') ?? []).map((option) => ({
    locale: option.getAttribute("data-locale") ?? "",
    label: option.querySelector(".locale-picker__label")?.textContent ?? "",
    flagSrc: (option.querySelector(".locale-picker__flag") as HTMLImageElement | null)?.getAttribute("src") ?? "",
  }));
}

function authLocaleOptionValues(): string[] {
  return authLocaleOptionDetails().map((option) => option.locale);
}

const EXPECTED_LOCALE_FLAG_PATHS = [
  "/assets/flags/us.svg",
  "/assets/flags/de.svg",
  "/assets/flags/fr.svg",
  "/assets/flags/br.svg",
  "/assets/flags/sa.svg",
  "/assets/flags/ru.svg",
];

const EXPECTED_PUBLIC_LOCALES = ["en", "de", "fr", "pt", "ar", "ru"];

async function selectAuthLocale(locale: string): Promise<void> {
  const button = getAuthLocaleSelect();
  button.click();
  const option = button.closest(".locale-picker")?.querySelector(`[role="option"][data-locale="${locale}"]`) as HTMLElement | null;
  if (!option) throw new Error(`missing auth locale option: ${locale}`);
  option.click();
  await flushPromises();
}

function getAuthLocalePickerSelectedLocale(): string {
  const selected = getAuthLocaleSelect()
    .closest(".locale-picker")
    ?.querySelector('[role="option"][aria-selected="true"]');
  return selected?.getAttribute("data-locale") ?? "";
}

describe("auth view i18n", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    localStorage.clear();
    apiFetchMock.mockReset();
    showToastMock.mockReset();
    redirectAfterAuthMock.mockReset();
    window.history.replaceState({}, "", "/");
  });

  afterEach(async () => {
    const i18n = await import("../i18n/index.js");
    i18n.resetI18nForTests();
    document.body.innerHTML = "";
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("renders English sign-in copy by default", async () => {
    await setupI18n("en");
    const auth = await import("./auth.js");

    auth.renderAuth({ next: "/dashboard", oidcEnabled: true, localAuthEnabled: true });

    expect(document.querySelector(".panel__title")?.textContent).toBe("Sign in");
    expect(document.querySelector(".muted")?.textContent?.trim()).toBe(
      "Authentication is enabled for this instance. Anonymous boards remain shareable by URL; durable projects require sign-in.",
    );
    expect(document.getElementById("authSsoBtn")?.textContent).toBe("Continue with SSO");
    expect(document.querySelector(".auth-divider span")?.textContent).toBe("or");
    expect((document.getElementById("authEmail") as HTMLInputElement | null)?.placeholder).toBe("Email");
    expect((document.getElementById("authPassword") as HTMLInputElement | null)?.placeholder).toBe("Password");
    expect(document.getElementById("loginBtn")?.textContent).toBe("Login");
    expect(document.getElementById("authPasswordToggle")?.getAttribute("aria-label")).toBe("Show password");
  });

  it("renders a public language selector in every auth shell", async () => {
    await setupI18n("en");
    const auth = await import("./auth.js");

    auth.renderAuth({ next: "/dashboard", oidcEnabled: true, localAuthEnabled: true });
    expect(authLocaleOptionValues()).toEqual(EXPECTED_PUBLIC_LOCALES);
    expect(authLocaleOptionDetails().map((option) => option.flagSrc)).toEqual(EXPECTED_LOCALE_FLAG_PATHS);
    expect(authLocaleOptionDetails().map((option) => option.label)).toEqual([
      "English",
      "Deutsch",
      "Français",
      "Português (Brasil)",
      "العربية",
      "Русский",
    ]);
    expect(authLocaleOptionValues()).not.toContain("pseudo");
    expect(getAuthLocaleSelect().getAttribute("aria-label")).toBe("Language");

    auth.renderAuth({ next: "/projects", bootstrap: true, oidcEnabled: false, localAuthEnabled: true });
    expect(authLocaleOptionValues()).toEqual(EXPECTED_PUBLIC_LOCALES);

    auth.renderResetPassword("reset-token");
    expect(authLocaleOptionValues()).toEqual(EXPECTED_PUBLIC_LOCALES);

    apiFetchMock.mockResolvedValueOnce({
      requires2fa: true,
      tempToken: "temp-token",
      user: { id: 7, email: "user@example.com" },
    });
    auth.renderAuth({ next: "/dashboard", localAuthEnabled: true });
    (document.getElementById("authEmail") as HTMLInputElement).value = "user@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "password";
    document.getElementById("authForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(document.querySelector(".panel__title")?.textContent).toBe("Two-factor authentication");
    expect(authLocaleOptionValues()).toEqual(EXPECTED_PUBLIC_LOCALES);
    expect(authLocaleOptionValues()).not.toContain("pseudo");
  });

  it("selecting Arabic in the auth selector sets RTL document direction", async () => {
    const i18n = await setupI18n("en");
    const auth = await import("./auth.js");

    auth.renderAuth({ next: "/dashboard", oidcEnabled: true, localAuthEnabled: true });
    await selectAuthLocale("ar");

    expect(i18n.getLocale()).toBe("ar");
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.querySelector(".panel__title")?.textContent).toBe("تسجيل الدخول");
  });

  it("selecting German in the auth selector persists locale and updates chrome without clearing sign-in fields", async () => {
    const i18n = await setupI18n("en");
    const auth = await import("./auth.js");

    auth.renderAuth({ next: "/dashboard?tab=mine", oidcEnabled: true, localAuthEnabled: true });
    const emailEl = document.getElementById("authEmail") as HTMLInputElement;
    const pwEl = document.getElementById("authPassword") as HTMLInputElement;
    emailEl.value = "user@example.com";
    pwEl.value = "secret";
    emailEl.dispatchEvent(new Event("input", { bubbles: true }));
    pwEl.dispatchEvent(new Event("input", { bubbles: true }));

    await selectAuthLocale("de");

    expect(i18n.getLocale()).toBe("de");
    expect(localStorage.getItem(i18n.LOCALE_STORAGE_KEY)).toBe("de");
    expect(getAuthLocalePickerSelectedLocale()).toBe("de");
    expect(getAuthLocaleSelect().getAttribute("aria-label")).toBe("Sprache");
    expect(document.querySelector(".panel__title")?.textContent).toBe("Anmelden");
    expect(document.getElementById("authSsoBtn")?.textContent).toBe("Mit SSO fortfahren");
    expect((document.getElementById("authEmail") as HTMLInputElement).value).toBe("user@example.com");
    expect((document.getElementById("authPassword") as HTMLInputElement).value).toBe("secret");
  });

  it("selecting a locale in bootstrap preserves typed admin fields", async () => {
    const i18n = await setupI18n("en");
    const auth = await import("./auth.js");

    auth.renderAuth({ next: "/projects", bootstrap: true, localAuthEnabled: true });
    const nameEl = document.getElementById("authName") as HTMLInputElement;
    const emailEl = document.getElementById("authEmail") as HTMLInputElement;
    const pwEl = document.getElementById("authPassword") as HTMLInputElement;
    nameEl.value = "Admin";
    emailEl.value = "admin@example.com";
    pwEl.value = "bootstrap-secret";
    nameEl.dispatchEvent(new Event("input", { bubbles: true }));
    emailEl.dispatchEvent(new Event("input", { bubbles: true }));
    pwEl.dispatchEvent(new Event("input", { bubbles: true }));

    await selectAuthLocale("fr");
    await flushPromises();

    expect(i18n.getLocale()).toBe("fr");
    expect(document.querySelector(".panel__title")?.textContent).toBe("Configuration initiale");
    expect(getAuthLocalePickerSelectedLocale()).toBe("fr");
    expect((document.getElementById("authName") as HTMLInputElement).value).toBe("Admin");
    expect((document.getElementById("authEmail") as HTMLInputElement).value).toBe("admin@example.com");
    expect((document.getElementById("authPassword") as HTMLInputElement).value).toBe("bootstrap-secret");
  });

  it("keeps pseudo hidden from the auth selector while displaying a public fallback", async () => {
    const i18n = await setupI18n("pseudo");
    const auth = await import("./auth.js");

    auth.renderAuth({ next: "/dashboard", oidcEnabled: true, localAuthEnabled: true });

    expect(i18n.getLocale()).toBe("pseudo");
    expect(document.querySelector(".panel__title")?.textContent).toBe("[!! Sign in !!]");
    expect(authLocaleOptionValues()).toEqual(EXPECTED_PUBLIC_LOCALES);
    expect(authLocaleOptionDetails().map((option) => option.flagSrc)).toEqual(EXPECTED_LOCALE_FLAG_PATHS);
    expect(authLocaleOptionValues()).not.toContain("pseudo");
    expect(getAuthLocalePickerSelectedLocale()).toBe("en");
    expect(getAuthLocaleSelect().getAttribute("aria-label")).toBe("[!! Language !!]");
  });

  it("renders English bootstrap and reset-password copy", async () => {
    await setupI18n("en");
    const auth = await import("./auth.js");

    auth.renderAuth({ next: "/projects", bootstrap: true, oidcEnabled: false, localAuthEnabled: true });
    expect(document.querySelector(".panel__title")?.textContent).toBe("First-time setup");
    expect((document.getElementById("authName") as HTMLInputElement | null)?.placeholder).toBe("Name");
    expect(document.getElementById("bootstrapBtn")?.textContent).toBe("Bootstrap");

    auth.renderResetPassword("reset-token");
    expect(document.querySelector(".panel__title")?.textContent).toBe("Reset Password");
    expect(document.querySelector(".field__label")?.textContent).toBe("New password");
    expect(document.getElementById("resetPasswordSubmit")?.textContent).toBe("Reset Password");
  });

  it("renders catalog-backed sign-in strings for de, fr, pt, and pseudo", async () => {
    const cases: Array<[TestLocale, string, string, string]> = [
      ["de", "Anmelden", "Mit SSO fortfahren", "Passwort"],
      ["fr", "Se connecter", "Continuer avec le SSO", "Mot de passe"],
      ["pt", "Entrar", "Continuar com SSO", "Senha"],
      ["pseudo", "[!! Sign in !!]", "[!! Continue with SSO !!]", "[!! Password !!]"],
    ];

    for (const [locale, title, sso, passwordPlaceholder] of cases) {
      await setupI18n(locale);
      const auth = await import("./auth.js");
      auth.renderAuth({ next: "/dashboard", oidcEnabled: true, localAuthEnabled: true });

      expect(document.querySelector(".panel__title")?.textContent).toBe(title);
      expect(document.getElementById("authSsoBtn")?.textContent).toBe(sso);
      expect((document.getElementById("authPassword") as HTMLInputElement | null)?.placeholder).toBe(passwordPlaceholder);

      const i18n = await import("../i18n/index.js");
      i18n.resetI18nForTests();
      document.body.innerHTML = "";
      vi.resetModules();
    }
  });

  it("rerenders sign-in chrome on locale change without losing typed values or next", async () => {
    const i18n = await setupI18n("en");
    const auth = await import("./auth.js");

    auth.renderAuth({ next: "/dashboard?tab=mine", oidcEnabled: true, localAuthEnabled: true });

    const emailEl = document.getElementById("authEmail") as HTMLInputElement;
    const pwEl = document.getElementById("authPassword") as HTMLInputElement;
    const toggle = document.getElementById("authPasswordToggle") as HTMLButtonElement;
    emailEl.value = "user@example.com";
    pwEl.value = "secret";
    emailEl.dispatchEvent(new Event("input", { bubbles: true }));
    pwEl.dispatchEvent(new Event("input", { bubbles: true }));
    toggle.click();

    await i18n.setLocale("pseudo");
    await flushPromises();

    expect(document.querySelector(".panel__title")?.textContent).toBe("[!! Sign in !!]");
    expect(document.getElementById("authSsoBtn")?.textContent).toBe("[!! Continue with SSO !!]");
    expect(document.querySelector(".auth-divider span")?.textContent).toBe("[!! or !!]");
    expect((document.getElementById("authEmail") as HTMLInputElement).value).toBe("user@example.com");
    expect((document.getElementById("authPassword") as HTMLInputElement).value).toBe("secret");
    expect((document.getElementById("authPassword") as HTMLInputElement).type).toBe("text");
    expect(document.getElementById("authPasswordToggle")?.getAttribute("aria-label")).toBe("[!! Hide password !!]");
    expect(document.getElementById("authSsoBtn")?.getAttribute("href")).toContain("return_to=%2Fdashboard%3Ftab%3Dmine");
  });

  it("rerenders bootstrap chrome on locale change without losing typed values", async () => {
    const i18n = await setupI18n("en");
    const auth = await import("./auth.js");

    auth.renderAuth({ next: "/projects", bootstrap: true, localAuthEnabled: true });

    const nameEl = document.getElementById("authName") as HTMLInputElement;
    const emailEl = document.getElementById("authEmail") as HTMLInputElement;
    const pwEl = document.getElementById("authPassword") as HTMLInputElement;
    nameEl.value = "Admin";
    emailEl.value = "admin@example.com";
    pwEl.value = "bootstrap-secret";
    nameEl.dispatchEvent(new Event("input", { bubbles: true }));
    emailEl.dispatchEvent(new Event("input", { bubbles: true }));
    pwEl.dispatchEvent(new Event("input", { bubbles: true }));

    await i18n.setLocale("fr");
    await flushPromises();

    expect(document.querySelector(".panel__title")?.textContent).toBe("Configuration initiale");
    expect(document.getElementById("bootstrapBtn")?.textContent).toBe("Initialiser");
    expect((document.getElementById("authName") as HTMLInputElement).value).toBe("Admin");
    expect((document.getElementById("authEmail") as HTMLInputElement).value).toBe("admin@example.com");
    expect((document.getElementById("authPassword") as HTMLInputElement).value).toBe("bootstrap-secret");
  });

  it("rerenders 2FA chrome on locale change without losing the typed code and keeps next on success", async () => {
    await setupI18n("en");
    const auth = await import("./auth.js");
    apiFetchMock.mockResolvedValueOnce({
      requires2fa: true,
      tempToken: "temp-token",
      user: { id: 7, email: "user@example.com" },
    });
    apiFetchMock.mockResolvedValueOnce({});

    auth.renderAuth({ next: "/dashboard?tab=mine", localAuthEnabled: true });

    (document.getElementById("authEmail") as HTMLInputElement).value = "user@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "password";
    document.getElementById("authForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(document.querySelector(".panel__title")?.textContent).toBe("Two-factor authentication");
    const i18n = await import("../i18n/index.js");
    const codeEl = document.getElementById("auth2FACode") as HTMLInputElement;
    codeEl.value = "123456";
    codeEl.dispatchEvent(new Event("input", { bubbles: true }));

    await i18n.setLocale("pt");
    await flushPromises();

    expect(document.querySelector(".panel__title")?.textContent).toBe("Autenticação de dois fatores");
    expect((document.getElementById("auth2FACode") as HTMLInputElement).value).toBe("123456");
    expect((document.getElementById("auth2FACode") as HTMLInputElement).placeholder).toBe("Código para user@example.com");

    document.getElementById("auth2FAForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/api/auth/login/2fa", {
      method: "POST",
      body: JSON.stringify({ tempToken: "temp-token", code: "123456" }),
    });
    expect(redirectAfterAuthMock).toHaveBeenCalledWith("/dashboard?tab=mine");
  });

  it("rerenders reset-password chrome on locale change without losing typed values or password visibility", async () => {
    const i18n = await setupI18n("en");
    const auth = await import("./auth.js");

    auth.renderResetPassword("reset-token");

    const newPwEl = document.getElementById("resetNewPassword") as HTMLInputElement;
    const confirmPwEl = document.getElementById("resetConfirmPassword") as HTMLInputElement;
    const toggle = document.getElementById("resetPasswordToggle") as HTMLButtonElement;
    newPwEl.value = "new-secret";
    confirmPwEl.value = "new-secret";
    newPwEl.dispatchEvent(new Event("input", { bubbles: true }));
    confirmPwEl.dispatchEvent(new Event("input", { bubbles: true }));
    toggle.click();

    await i18n.setLocale("de");
    await flushPromises();

    expect(document.querySelector(".panel__title")?.textContent).toBe("Passwort zurücksetzen");
    expect(document.querySelector(".field__label")?.textContent).toBe("Neues Passwort");
    expect((document.getElementById("resetNewPassword") as HTMLInputElement).value).toBe("new-secret");
    expect((document.getElementById("resetConfirmPassword") as HTMLInputElement).value).toBe("new-secret");
    expect((document.getElementById("resetNewPassword") as HTMLInputElement).type).toBe("text");
    expect(document.getElementById("resetPasswordToggle")?.getAttribute("aria-label")).toBe("Passwort verbergen");
  });

  it("keeps login submission behavior unchanged on success", async () => {
    await setupI18n("en");
    const auth = await import("./auth.js");
    apiFetchMock.mockResolvedValueOnce({});

    auth.renderAuth({ next: "/projects?from=auth", localAuthEnabled: true });
    (document.getElementById("authEmail") as HTMLInputElement).value = "user@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "password";
    document.getElementById("authForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "password" }),
    });
    expect(redirectAfterAuthMock).toHaveBeenCalledWith("/projects?from=auth");
  });

  it("keeps bootstrap submission behavior unchanged on success", async () => {
    await setupI18n("en");
    const auth = await import("./auth.js");
    apiFetchMock.mockResolvedValueOnce({});

    auth.renderAuth({ next: "/projects", bootstrap: true, localAuthEnabled: true });
    (document.getElementById("authName") as HTMLInputElement).value = "Admin";
    (document.getElementById("authEmail") as HTMLInputElement).value = "admin@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "secret";
    document.getElementById("bootstrapBtn")?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledWith("/api/auth/bootstrap", {
      method: "POST",
      body: JSON.stringify({ name: "Admin", email: "admin@example.com", password: "secret" }),
    });
    expect(redirectAfterAuthMock).toHaveBeenCalledWith("/projects");
  });

  it("keeps reset-password submission behavior unchanged on success", async () => {
    await setupI18n("en");
    const auth = await import("./auth.js");
    apiFetchMock.mockResolvedValueOnce({});
    window.history.replaceState({}, "", "/auth/reset-password?token=reset-token");

    auth.renderResetPassword("reset-token");
    (document.getElementById("resetNewPassword") as HTMLInputElement).value = "new-password";
    (document.getElementById("resetConfirmPassword") as HTMLInputElement).value = "new-password";
    document.getElementById("resetPasswordForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledWith("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token: "reset-token", new_password: "new-password" }),
    });
    expect(showToastMock).toHaveBeenCalledWith("Password reset successfully. Please log in.");
    expect(window.location.pathname).toBe("/");
  });

  it("localizes compatible auth API failures and preserves raw backend detail when no mapping exists", async () => {
    const i18n = await setupI18n("de");
    const auth = await import("./auth.js");

    apiFetchMock.mockRejectedValueOnce({
      status: 401,
      message: "raw unauthorized",
      data: { error: { code: "UNAUTHORIZED", message: "raw unauthorized" } },
    });

    auth.renderAuth({ next: "/dashboard", localAuthEnabled: true });
    (document.getElementById("authEmail") as HTMLInputElement).value = "user@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "bad";
    document.getElementById("authForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(showToastMock).toHaveBeenLastCalledWith("Nicht angemeldet");

    apiFetchMock.mockRejectedValueOnce({
      status: 400,
      message: "Password must be at least 12 characters",
      data: { error: { message: "Password must be at least 12 characters" } },
    });

    auth.renderAuth({ next: "/projects", bootstrap: true, localAuthEnabled: true });
    (document.getElementById("authName") as HTMLInputElement).value = "Admin";
    (document.getElementById("authEmail") as HTMLInputElement).value = "admin@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "short";
    document.getElementById("bootstrapBtn")?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();

    expect(showToastMock).toHaveBeenLastCalledWith("Password must be at least 12 characters");

    await i18n.setLocale("en");
  });

  it("shows localized OIDC query-param failures, cleans the URL, and does not retrigger them on locale change", async () => {
    const i18n = await setupI18n("fr");
    const auth = await import("./auth.js");
    window.history.replaceState({}, "", "/dashboard?oidc_error=state_invalid");

    auth.renderAuth({ next: "/dashboard", oidcEnabled: true, localAuthEnabled: true });

    expect(showToastMock).toHaveBeenCalledWith("La session de connexion a expiré ou est invalide. Veuillez réessayer.");
    expect(window.location.search).toBe("");

    showToastMock.mockClear();
    await i18n.setLocale("pt");
    await flushPromises();

    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("preserves explicit next exactly and strips oidc_error from derived SSO return_to", async () => {
    await setupI18n("en");
    const auth = await import("./auth.js");
    window.history.replaceState({}, "", "/dashboard?tab=mine&oidc_error=state_invalid");

    auth.renderAuth({ next: "/dashboard?tab=mine", oidcEnabled: true, localAuthEnabled: true });

    expect(showToastMock).toHaveBeenCalledWith("Login session expired or invalid. Please try again.");
    expect(window.location.search).toBe("?tab=mine");
    expect(document.getElementById("authSsoBtn")?.getAttribute("href")).toContain(
      "return_to=%2Fdashboard%3Ftab%3Dmine",
    );
    expect(document.getElementById("authSsoBtn")?.getAttribute("href")).not.toContain("oidc_error");

    showToastMock.mockClear();
    document.body.innerHTML = "";
    vi.resetModules();
    await setupI18n("en");
    const authDerived = await import("./auth.js");
    window.history.replaceState({}, "", "/projects?oidc_error=provider");

    authDerived.renderAuth({ oidcEnabled: true, localAuthEnabled: true });

    expect(showToastMock).toHaveBeenCalledWith("The identity provider returned an error.");
    expect(window.location.search).toBe("");
    expect(document.getElementById("authSsoBtn")?.getAttribute("href")).toContain("return_to=%2Fprojects");
    expect(document.getElementById("authSsoBtn")?.getAttribute("href")).not.toContain("oidc_error");
  });

  it("strips oidc_error from explicit router-style next for SSO return_to after cleanup", async () => {
    await setupI18n("en");
    const auth = await import("./auth.js");
    window.history.replaceState({}, "", "/dashboard?oidc_error=token");

    auth.renderAuth({
      next: "/dashboard?oidc_error=token",
      oidcEnabled: true,
      localAuthEnabled: true,
    });

    expect(showToastMock).toHaveBeenCalledOnce();
    expect(window.location.search).toBe("");
    expect(document.getElementById("authSsoBtn")?.getAttribute("href")).toContain("return_to=%2Fdashboard");
    expect(document.getElementById("authSsoBtn")?.getAttribute("href")).not.toContain("oidc_error");
  });

  it("uses the sanitized explicit next for bootstrap, login, and 2FA redirects after OIDC cleanup", async () => {
    await setupI18n("en");
    const auth = await import("./auth.js");
    const sanitizedNext = "/projects?tab=mine";
    const explicitNext = `${sanitizedNext}&oidc_error=state_invalid`;

    window.history.replaceState({}, "", "/auth?oidc_error=state_invalid");
    apiFetchMock.mockResolvedValueOnce({});
    auth.renderAuth({ next: explicitNext, bootstrap: true, oidcEnabled: true, localAuthEnabled: true });
    (document.getElementById("authName") as HTMLInputElement).value = "Admin";
    (document.getElementById("authEmail") as HTMLInputElement).value = "admin@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "secret";
    document.getElementById("bootstrapBtn")?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(redirectAfterAuthMock).toHaveBeenLastCalledWith(sanitizedNext);

    document.body.innerHTML = "";
    redirectAfterAuthMock.mockReset();
    apiFetchMock.mockReset();
    window.history.replaceState({}, "", "/auth?oidc_error=state_invalid");
    apiFetchMock.mockResolvedValueOnce({});
    auth.renderAuth({ next: explicitNext, oidcEnabled: true, localAuthEnabled: true });
    (document.getElementById("authEmail") as HTMLInputElement).value = "user@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "password";
    document.getElementById("authForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(redirectAfterAuthMock).toHaveBeenLastCalledWith(sanitizedNext);

    document.body.innerHTML = "";
    redirectAfterAuthMock.mockReset();
    apiFetchMock.mockReset();
    window.history.replaceState({}, "", "/auth?oidc_error=state_invalid");
    apiFetchMock.mockResolvedValueOnce({
      requires2fa: true,
      tempToken: "temp-token",
      user: { id: 7, email: "user@example.com" },
    });
    apiFetchMock.mockResolvedValueOnce({});
    auth.renderAuth({ next: explicitNext, oidcEnabled: true, localAuthEnabled: true });
    (document.getElementById("authEmail") as HTMLInputElement).value = "user@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "password";
    document.getElementById("authForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();
    (document.getElementById("auth2FACode") as HTMLInputElement).value = "123456";
    document.getElementById("auth2FAForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(redirectAfterAuthMock).toHaveBeenLastCalledWith(sanitizedNext);
  });

  it("binds one auth locale listener across repeated auth renders and transitions", async () => {
    const i18n = await import("../i18n/index.js");
    await i18n.initI18n({ locale: "en", loadLocale: loader() });
    const addListenerSpy = vi.spyOn(document, "addEventListener");
    const auth = await import("./auth.js");
    apiFetchMock.mockResolvedValueOnce({
      requires2fa: true,
      tempToken: "temp-token",
      user: { id: 7, email: "user@example.com" },
    });

    auth.renderAuth({ next: "/dashboard", oidcEnabled: true, localAuthEnabled: true });
    auth.renderAuth({ next: "/projects", oidcEnabled: true, localAuthEnabled: true });

    (document.getElementById("authEmail") as HTMLInputElement).value = "user@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "password";
    document.getElementById("authForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();

    auth.renderResetPassword("reset-token");

    const localeListenerAdds = addListenerSpy.mock.calls.filter(
      ([eventName]) => eventName === i18n.I18N_LOCALE_CHANGED,
    );
    expect(localeListenerAdds).toHaveLength(1);
    addListenerSpy.mockRestore();
  });

  it("does not apply auth translations after navigating away from the auth page", async () => {
    const i18n = await setupI18n("en");
    const auth = await import("./auth.js");

    auth.renderAuth({ next: "/dashboard", localAuthEnabled: true });
    document.body.innerHTML = `<div class="page page--projects"><h1 class="panel__title">Projects</h1></div>`;

    await i18n.setLocale("de");
    await flushPromises();

    expect(document.querySelector(".panel__title")?.textContent).toBe("Projects");
  });

  it("keeps login submission payload unchanged after locale change", async () => {
    const i18n = await setupI18n("en");
    const auth = await import("./auth.js");
    apiFetchMock.mockResolvedValueOnce({});

    auth.renderAuth({ next: "/projects?from=auth", localAuthEnabled: true });
    (document.getElementById("authEmail") as HTMLInputElement).value = "user@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "password";
    (document.getElementById("authEmail") as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
    (document.getElementById("authPassword") as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));

    await i18n.setLocale("fr");
    await flushPromises();

    document.getElementById("authForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "password" }),
    });
    expect(redirectAfterAuthMock).toHaveBeenCalledWith("/projects?from=auth");
  });

  it("localizes 429 auth failures through errors.RATE_LIMITED and uses fallback keys only without useful detail", async () => {
    await setupI18n("de");
    const auth = await import("./auth.js");

    apiFetchMock.mockRejectedValueOnce({ status: 429, message: "HTTP 429" });
    auth.renderAuth({ next: "/dashboard", localAuthEnabled: true });
    (document.getElementById("authEmail") as HTMLInputElement).value = "user@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "password";
    document.getElementById("authForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(showToastMock).toHaveBeenLastCalledWith("Zu viele Versuche. Bitte später erneut versuchen.");

    apiFetchMock.mockRejectedValueOnce({ status: 500, message: "HTTP 500" });
    auth.renderAuth({ next: "/dashboard", localAuthEnabled: true });
    (document.getElementById("authEmail") as HTMLInputElement).value = "user@example.com";
    (document.getElementById("authPassword") as HTMLInputElement).value = "password";
    document.getElementById("authForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(showToastMock).toHaveBeenLastCalledWith("Anmeldung fehlgeschlagen.");
  });

  it("shows the localized reset-password mismatch message", async () => {
    await setupI18n("pt");
    const auth = await import("./auth.js");

    auth.renderResetPassword("reset-token");
    (document.getElementById("resetNewPassword") as HTMLInputElement).value = "one";
    (document.getElementById("resetConfirmPassword") as HTMLInputElement).value = "two";
    document.getElementById("resetPasswordForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(showToastMock).toHaveBeenCalledWith("As senhas não coincidem");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
