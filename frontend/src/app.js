import { registerRoute, renderRoute, navigate } from "./router.js";
import { authService } from "./services/authService.js";

import { HomePage } from "./pages/Home.js";
import { LoginPage } from "./pages/Login.js";
import { OnboardingPage } from "./pages/Onboarding.js";
import { MemberDashboard } from "./pages/MemberDashboard.js";
import { MemberAiDashboard } from "./pages/MemberAiDashboard.js";
import { TrainerDashboard } from "./pages/TrainerDashboard.js";
import { TrainerUsersPage } from "./pages/TrainerUsers.js";
import { AdminDashboard } from "./pages/AdminDashboard.js";
import { AdminUsersPage } from "./pages/AdminUsers.js";
import { AdminClassTypesPage } from "./pages/AdminClassTypes.js";
import { AdminTrainersPage } from "./pages/AdminTrainers.js";
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
registerRoute("/trainer-usuarios", TrainerUsersPage);
registerRoute("/admin", AdminDashboard);
registerRoute("/admin-usuarios", AdminUsersPage);
registerRoute("/admin-tipos", AdminClassTypesPage);
registerRoute("/admin-entrenadores", AdminTrainersPage);
registerRoute("/404", NotFoundPage);
registerRoute("/suscripcion", SubscriptionPage);
registerRoute("/recuperar-password", PasswordRecoveryStartPage);
registerRoute("/recuperar-codigo", PasswordRecoveryCodePage);
registerRoute("/cambiar-password", PasswordRecoveryResetPage);

await authService.loadSession();

if (!location.hash) navigate("/");
renderRoute(); // SOLO una vez
