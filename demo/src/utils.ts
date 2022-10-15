
export function randomStrings(prefix: string, count: number = 5): string[] {
    const result = [];
    for (var i: number = 0; i < count; i++) {
        result.push(`${prefix}${i + 1}`);
    }
    return result;
}

const texts = ['A', 'B', 'C', 'D', 'E', 1, 2, 3, 4, 5]
export function randomTexts(count: number = 5): string[] {
    const result = [];
    for (var i: number = 0; i < count; i++) {
        result.push(`${texts.map(() => texts[parseInt(Math.random() * texts.length + '')]).join('')}${i + 1}`);
    }
    return result;
}
export function addClass(el: HTMLElement, className: string) {
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
export function removeClass(el: HTMLElement, className: string) {
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
const appendedCSSTags = {};
export function appendCSSTag(cssText, params?) {
    if (document && document.head) {
        const dom = document.createElement('style');
        dom.type = 'text/css';
        dom.innerHTML = cssText;
        params = params || {};
        Object.keys(params).forEach(key => {
            key && dom.setAttribute(key, params[key]);
        })
        document.head.appendChild(dom);
    }
}

export function appendCSSTagOnce(id, cssText, params?) {
    if (appendedCSSTags[id]) return;
    appendedCSSTags[id] = true;
    appendCSSTag(cssText, params);
}