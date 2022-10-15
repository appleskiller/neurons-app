import { DemoAbout } from "../pages/about";
import { IRouterConfig } from "../../../src/router/interfaces";
import { DemoHome } from "../pages/home";

export const routes: IRouterConfig[] = [{
    path: '',
    redirectTo: 'home',
}, {
    path: 'home',
    component: DemoHome
}, {
    path: 'about',
    component: DemoAbout
}]
