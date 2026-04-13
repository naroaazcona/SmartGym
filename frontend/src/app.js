import { registerRoute, renderRoute, navigate } from "./router.js";
import { authService } from "./services/authService.js";

import { HomePage } from "./pages/Home.js";
import { LoginPage } from "./pages/Login.js";
import { OnboardingPage } from "./pages/Onboarding.js";
import { MemberDashboard } from "./pages/MemberDashboard.js";
import { MemberAiDashboard } from "./pages/MemberAiDashboard.js";
import { TrainerDashboard } from "./pages/TrainerDashboard.js";
import { AdminDashboard } from "./pages/AdminDashboard.js";
import { ProfilePage } from "./pages/Profile.js";
import { MyReservationsPage } from "./pages/MyReservations.js";
import { NotFoundPage } from "./pages/NotFound.js";
import { SubscriptionPage } from "./pages/Subscription.js";
import {
  PasswordRecoveryStartPage,
  PasswordRecoveryCodePage,
  PasswordRecoveryResetPage,
} from "./pages/PasswordRecovery.js";

registerRoute("/", HomePage);
registerRoute("/login", LoginPage);
registerRoute("/onboarding", OnboardingPage);
registerRoute("/perfil", ProfilePage);
registerRoute("/member", MemberDashboard);
registerRoute("/member-ia", MemberAiDashboard);
registerRoute("/mis-reservas", MyReservationsPage);
registerRoute("/trainer", TrainerDashboard);
registerRoute("/admin", AdminDashboard);
registerRoute("/404", NotFoundPage);
registerRoute("/suscripcion", SubscriptionPage);
registerRoute("/recuperar-password", PasswordRecoveryStartPage);
registerRoute("/recuperar-codigo", PasswordRecoveryCodePage);
registerRoute("/cambiar-password", PasswordRecoveryResetPage);

await authService.loadSession();

if (!location.hash) navigate("/");
renderRoute(); // SOLO una vez
