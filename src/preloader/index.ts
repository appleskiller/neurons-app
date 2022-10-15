
const isDomLevel2: boolean = typeof window !== 'undefined' && typeof window.document !== 'undefined' && !!window.addEventListener;

function addClass(el: HTMLElement, className: string) {
    if (!el || el.nodeType !== 1 || !className) return;
    const classNames = className.match(/[^\x20\t\r\n\f]+/g);
    if (!classNames || !classNames.length) return;
    const elClassName = el.getAttribute("class");
    if (!elClassName) {
        el.setAttribute('class', className);
    } else {
        let elClass = ' ' + elClassName + ' ';
        for (let i = 0; i < classNames.length; i++) {
            if (elClass.indexOf(' ' + classNames[i] + ' ') === -1) {
                elClass += classNames[i] + ' ';
            }
        }
        el.setAttribute('class', elClass.trim());
    }
}
function removeClass(el: HTMLElement, className: string) {
    if (!el || el.nodeType !== 1) return;
    const elClassName = el.getAttribute("class");
    if (!elClassName) return;
    className = className || '';
    const classNames = className.match(/[^\x20\t\r\n\f]+/g);
    if (!classNames || !classNames.length) {
        el.setAttribute('class', '');
    } else {
        let elClass = ' ' + elClassName + ' ';
        for (let i = 0; i < classNames.length; i++) {
            elClass = elClass.replace(' ' + classNames[i] + ' ', ' ');
        }
        el.setAttribute('class', elClass.trim());
    }
}

function removeMe(dom) {
    if (!dom) return;
    if (typeof dom.remove === 'function') {
        dom.remove();
    } else {
        if (dom.parentNode !== null) dom.parentNode.removeChild(dom);
    }
}

function fixEventType(el, name) {
    if (name === 'mousewheel') {
        if (el.onmousewheel === undefined) {
            // 兼容firefox滚轮事件，事件类型为DOMMouseScroll且只能使用DOM2级事件绑定
            name = "DOMMouseScroll";
        }
    }
    return name;
}
function wrapEvent(name, e) {
    e = e || window.event;
    if (!('stopPropagation' in e)) {
        e.stopPropagation = function () { e.cancelBubble = true; }
    }
    if (!('stopImmediatePropagation' in e)) {
        e.stopImmediatePropagation = function () { e.cancelBubble = true; }
    }
    if (!('preventDefault' in e)) {
        e.preventDefault = function () { e.returnValue = false; e.defaultPrevented = true; }
        e.defaultPrevented = false;
    }
    if (name === 'mousewheel') {
        // firefox滚轮事件滚动方向兼容
        if (!e.wheelDelta) {
            e.wheelDelta = e.detail / -3 * 120;
        }
    }
    return e;
}

function removeEventListener(el, name, handler) {
    if (!el) return;
    if (isDomLevel2) {
        el.removeEventListener(name, handler);
    } else {
        el.detachEvent('on' + name, handler);
    }
}
function addEventListener(el, name, handler): () => void {
    const type = fixEventType(el, name);
    const _handle = function (e) {
        e = wrapEvent(name, e);
        return handler.call(this, e);
    }
    if (isDomLevel2) {
        el.addEventListener(type, _handle);
    } else {
        el.attachEvent('on' + type, _handle);
    }
    return function () {
        removeEventListener(el, type, _handle);
    };
}

export interface IPreloader {
    show(): void;
    hide(immediately?: boolean): void;
    error(msg: string, error?: Error, retryFn?: () => void): void;
}

const noop = () => {};
/**
 * 预加载动画。
 * 如果需要在index.html加载后立刻出现预加载动画，且要求后续应用组件的预加载动画的一致性，可将文件中的html和style复制粘贴到index.html中。
 * 各个顶级路由页面应在合适的时机手动调用preloader.hide()来隐藏动画。
 */
export class Preloader implements IPreloader {
    private _container: HTMLElement;
    private _retryFn = noop;
    private _retryListener: () => void;
    private _styleAttached = false;
    private _hideTimeId;
    private _showTimeId;
    private _isFirstLoad = true;

    show(): void {
        this._showLoading();
    }
    hide(immediately?: boolean): void {
        this._hideLoading(immediately);
    }
    error(msg: string, error?: Error, retryFn?: () => void): void {
        this._showError(msg, error, retryFn);
    }

    protected active() {
        this._container = document.body.querySelector('.preloading-container');
        if (!this._container) {
            // style
            if (!this._styleAttached) {
                const styleContainer = document.createElement('style');
                styleContainer.setAttribute('type', 'text/css');
                styleContainer.innerHTML = this._generateStyle();
                document.head.appendChild(styleContainer);
                this._styleAttached = true;
            }
            this._container = document.createElement('div');
            this._container.className = 'preloading-container active';
            const html = document.getElementsByTagName('html')[0];
            const theme = html ? (html.getAttribute('theme') || 'black') : 'black';
            const fill = (theme === 'black') ? 'white' : 'rgb(48, 125, 218)';
            this._container.innerHTML = `
                <div class="preloading-container active">
                    <div class="preloading-loading active">
                        <div class="preloading-loading-layout">
                            <div class="sk-wave">
                                <div class="sk-rect sk-rect-1"></div>
                                <div class="sk-rect sk-rect-2"></div>
                                <div class="sk-rect sk-rect-3"></div>
                                <div class="sk-rect sk-rect-4"></div>
                                <div class="sk-rect sk-rect-5"></div>
                            </div>
                        </div>
                    </div>
                    <div class="preloading-error">
                        <div class="preloading-error-layout">
                            <div class="preloading-message"></div>
                            <div class="preloading-retry-button">重试</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    private _showError(msg, error, retryFn) {
        if (!this._container) return;
        this._hideLoading(true);
        !document.body.contains(this._container) && document.body.appendChild(this._container);
        const loadingDom: HTMLElement = this._container.querySelector('.preloading-loading');
        const messageDom: HTMLElement = this._container.querySelector('.preloading-message');
        const errorDom: HTMLElement = this._container.querySelector('.preloading-error');
        const retryBtn = this._container.querySelector('.preloading-retry-button');
        this._retryListener && this._retryListener();
        messageDom.innerText = msg || '加载失败';
        addClass(this._container, 'active');
        addClass(errorDom, 'active');
        removeClass(loadingDom, 'active');
        this._retryFn = retryFn || noop;
        this._retryListener = addEventListener(retryBtn, 'click', this._retryFn);
        console.error(error);
    }
    private _showLoading() {
        if (!this._container) return;
        this._hideLoading(true);
        !document.body.contains(this._container) && document.body.appendChild(this._container);
        const loadingDom: HTMLElement = this._container.querySelector('.preloading-loading');
        const messageDom: HTMLElement = this._container.querySelector('.preloading-message');
        const errorDom: HTMLElement = this._container.querySelector('.preloading-error');
        const retryBtn = this._container.querySelector('.preloading-retry-button');
        this._retryListener && this._retryListener();
        this._retryFn = noop;
        messageDom.innerText = '';
        clearTimeout(this._showTimeId);
        // 延时显示
        setTimeout(() => {
            addClass(this._container, 'active');
            addClass(loadingDom, 'active');
            removeClass(errorDom, 'active');
        }, this._isFirstLoad ? 0 : 250);
    }
    private _hideLoading(immediately?) {
        if (!this._container) return;
        const loadingDom: HTMLElement = this._container.querySelector('.preloading-loading');
        const messageDom: HTMLElement = this._container.querySelector('.preloading-message');
        const errorDom: HTMLElement = this._container.querySelector('.preloading-error');
        const retryBtn = this._container.querySelector('.preloading-retry-button');
        this._retryListener && this._retryListener();
        this._retryFn = noop;
        messageDom.innerText = '';
        removeClass(this._container, 'active');
        removeClass(loadingDom, 'active');
        removeClass(errorDom, 'active');
        clearTimeout(this._showTimeId);
        clearTimeout(this._hideTimeId);
        if (immediately || !this._isFirstLoad) {
            removeMe(this._container);
        } else {
            this._isFirstLoad = false;
            this._hideTimeId = setTimeout(() => {
                removeMe(this._container);
            }, 500);
        }
    }
    private _generateStyle() {
        return `
            .preloading-container {
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                right: 0;
                color: #FFF;
                opacity: 0;
                transition: opacity 480ms cubic-bezier(.4,0,.2,1);
            }
            .preloading-container.active {
                opacity: 1;
            }
            .preloading-container .preloading-error,
            .preloading-container .preloading-loading {
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                right: 0;
                opacity: 0;
                transition: opacity 480ms cubic-bezier(.4,0,.2,1);
            }
            .preloading-container .preloading-error.active,
            .preloading-container .preloading-loading.active {
                opacity: 1;
            }
            .preloading-container .preloading-loading .preloading-loading-layout {
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                right: 0;
                margin: auto;
                text-align: center;
                height: 40px;
                line-height: 40px;
            }
            .preloading-container .preloading-loading .preloading-loading-layout > * {
                display: inline-block;
                vertical-align: middle;
            }
            .preloading-container .preloading-error .preloading-error-layout {
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                right: 0;
                margin: auto;
                height: 62px;
                text-align: center;
            }
            .preloading-container .preloading-error .preloading-retry-button {
                display: inline-block;
                border: solid 1px rgba(216,225,243,0.03);
                background-color: rgba(67, 124, 240, 1);
                cursor: pointer;
                color: #FFF;
                padding: 3px 20px;
                margin-top: 12px;
                border-radius: 3px;
                
                -webkit-transition: all 280ms cubic-bezier(.4,0,.2,1);
                -moz-transition: all 280ms cubic-bezier(.4,0,.2,1);
                -ms-transition: all 280ms cubic-bezier(.4,0,.2,1);
                -o-transition: all 280ms cubic-bezier(.4,0,.2,1);
                transition: all 280ms cubic-bezier(.4,0,.2,1);
            }
            .preloading-container .preloading-error .preloading-retry-button:hover {
                background-color: rgba(67, 124, 240, 0.8);
            }
            @-webkit-keyframes sk-wave-stretch-delay {
                0%, 40%, 100% {
                    -webkit-transform: scaleY(0.4);
                            transform: scaleY(0.4);
                }
                20% {
                    -webkit-transform: scaleY(1);
                            transform: scaleY(1);
                }
            }

            @keyframes sk-wave-stretch-delay {
                0%, 40%, 100% {
                    -webkit-transform: scaleY(0.4);
                            transform: scaleY(0.4);
                }
                20% {
                    -webkit-transform: scaleY(1);
                            transform: scaleY(1);
                }
            }
            .sk-wave {
                width: 32px;
                height: 32px;
                margin: auto;
                text-align: center;
                font-size: 0;
            }
            .sk-wave .sk-rect {
                background-color: rgb(48, 125, 218);
                height: 100%;
                width: 12%;
                margin: 0 1px;
                box-sizing: border-box;
                display: inline-block;
                font-size: 12px;
                display: inline-block;
                -webkit-animation: sk-wave-stretch-delay 1.2s infinite ease-in-out;
                        animation: sk-wave-stretch-delay 1.2s infinite ease-in-out;
            }
            .sk-wave .sk-rect-1 {
                -webkit-animation-delay: -1.2s;
                        animation-delay: -1.2s;
            }
            .sk-wave .sk-rect-2 {
                -webkit-animation-delay: -1.1s;
                        animation-delay: -1.1s;
            }
            .sk-wave .sk-rect-3 {
                -webkit-animation-delay: -1s;
                        animation-delay: -1s;
            }
            .sk-wave .sk-rect-4 {
                -webkit-animation-delay: -0.9s;
                        animation-delay: -0.9s;
            }
            .sk-wave .sk-rect-5 {
                -webkit-animation-delay: -0.8s;
                        animation-delay: -0.8s;
            }
        `
    }
}

export const preloader = new Preloader();