import { INavigateData, IRouterGuard, ObservableLike } from "./interfaces";

export class RouterGuard implements IRouterGuard {
    canActivate(navigateData: INavigateData): boolean | ObservableLike<boolean> | Promise<boolean> {
        return true;
    }
}
