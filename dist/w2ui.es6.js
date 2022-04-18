/* w2ui 2.0.x (nightly) (4/18/2022, 4:57:38 AM) (c) http://w2ui.com, vitmalina@gmail.com */
/**
 * Part of w2ui 2.0 library
 *  - Dependencies: w2utils
 *  - there is a doc file ../details/w2base.html
 *  - on/off/trigger methods id not showing in help
 *  - refactored with event object
 *  - added "awai event.complete" syntax
 *
 * 2.0 Updates
 *  - on(), off() - can have events separated by comma or space
 */

class w2event {
    constructor(owner, edata) {
        Object.assign(this, {
            type: edata.type ?? null,
            detail: edata,
            owner,
            target: edata.target ?? null,
            phase: edata.phase ?? 'before',
            object: edata.object ?? null,
            execute: null,
            isStopped: false,
            isCancelled: false,
            onComplete: null,
            doneHandlers: []
        })
        delete edata.type
        delete edata.target
        delete edata.object
        this.complete = new Promise((resolve, reject) => {
            this._resolve = resolve
            this._reject = reject
        })
    }
    finish(detail) {
        if (detail) {
            w2utils.extend(this.detail, detail)
        }
        this.phase = 'after'
        this.owner.trigger.call(this.owner, this)
    }
    done(handler) {
        this.doneHandlers.push(handler)
    }
    preventDefault() {
        this._reject()
        this.isCancelled = true
    }
    stopPropagation() {
        this.isStopped = true
    }
}
class w2base {
    /**
     * Initializes base object for w2ui, registers it with w2ui object
     *
     * @param {string} name  - name of the object
     * @returns
     */
    constructor(name) {
        this.activeEvents = [] // events that are currently processing
        this.listeners = [] // event listeners
        // register globally
        if (typeof name !== 'undefined') {
            if (!w2utils.checkName(name)) return
            w2ui[name] = this
        }
        this.debug    = false // if true, will trigger all events
    }
    /**
     * Adds event listener, supports event phase and event scoping
     *
     * @param {*} edata - an object or string, if string "eventName:phase.scope"
     * @param {*} handler
     * @returns itself
     */
    on(events, handler) {
        if (typeof events == 'string') {
            events = events.split(/[,\s]+/) // separate by comma or space
        } else {
            events = [events]
        }
        events.forEach(edata => {
            let name = typeof edata == 'string' ? edata : (edata.type + ':' + edata.execute + '.' + edata.scope)
            if (typeof edata == 'string') {
                let [eventName, scope] = edata.split('.')
                let [type, execute] = eventName.replace(':complete', ':after').replace(':done', ':after').split(':')
                edata = { type, execute: execute ?? 'before', scope }
            }
            edata = w2utils.extend({ type: null, execute: 'before', onComplete: null }, edata)
            // errors
            if (!edata.type) { console.log('ERROR: You must specify event type when calling .on() method of '+ this.name); return }
            if (!handler) { console.log('ERROR: You must specify event handler function when calling .on() method of '+ this.name); return }
            if (!Array.isArray(this.listeners)) this.listeners = []
            this.listeners.push({ name, edata, handler })
            if (this.debug) {
                console.log('w2base: add event', { name, edata, handler })
            }
        })
        return this
    }
    /**
     * Removes event listener, supports event phase and event scoping
     *
     * @param {*} edata - an object or string, if string "eventName:phase.scope"
     * @param {*} handler
     * @returns itself
     */
    off(events, handler) {
        if (typeof events == 'string') {
            events = events.split(/[,\s]+/) // separate by comma or space
        } else {
            events = [events]
        }
        events.forEach(edata => {
            let name = typeof edata == 'string' ? edata : (edata.type + ':' + edata.execute + '.' + edata.scope)
            if (typeof edata == 'string') {
                let [eventName, scope] = edata.split('.')
                let [type, execute] = eventName.replace(':complete', ':after').replace(':done', ':after').split(':')
                edata = { type: type || '*', execute: execute || '', scope: scope || '' }
            }
            edata = w2utils.extend({ type: null, execute: null, onComplete: null }, edata)
            // errors
            if (!edata.type && !edata.scope) { console.log('ERROR: You must specify event type when calling .off() method of '+ this.name); return }
            if (!handler) { handler = null }
            let count = 0
            // remove listener
            this.listeners = this.listeners.filter(curr => {
                if (   (edata.type === '*' ||  edata.type === curr.edata.type)
                    && (edata.execute === '' ||  edata.execute === curr.edata.execute)
                    && (edata.scope === '' ||  edata.scope === curr.edata.scope)
                    && (edata.handler == null ||  edata.handler === curr.edata.handler)
                ) {
                    count++ // how many listeners removed
                    return false
                } else {
                    return true
                }
            })
            if (this.debug) {
                console.log(`w2base: remove event (${count})`, { name, edata, handler })
            }
        })
        return this // needed for chaining
    }
    /**
     * Triggers even listeners for a specific event, loops through this.listeners
     *
     * @param {Object} edata - Object
     * @returns modified edata
     */
    trigger(eventName, edata) {
        if (arguments.length == 1) {
            edata = eventName
        } else {
            edata.type = eventName
            edata.target = edata.target ?? this
        }
        if (w2utils.isPlainObject(edata) && edata.phase == 'after') {
            // find event
            edata = this.activeEvents.find(event => {
                if (event.type == edata.type && event.target == edata.target) {
                    return true
                }
                return false
            })
            if (!edata) {
                console.log(`ERROR: Cannot find even handler for "${edata.type}" on "${edata.target}".`)
                return
            }
            console.log('NOTICE: This syntax "edata.trigger({ phase: \'after\' })" is outdated. Use edata.finish() instead.');
        } else if (!(edata instanceof w2event)) {
            edata = new w2event(this, edata)
            this.activeEvents.push(edata)
        }
        let args, fun, tmp
        if (!Array.isArray(this.listeners)) this.listeners = []
        if (this.debug) {
            console.log(`w2base: trigger "${edata.type}:${edata.phase}"`, edata)
        }
        // process events in REVERSE order
        for (let h = this.listeners.length-1; h >= 0; h--) {
            let item = this.listeners[h]
            if (item != null && (item.edata.type === edata.type || item.edata.type === '*') &&
                (item.edata.target === edata.target || item.edata.target == null) &&
                (item.edata.execute === edata.phase || item.edata.execute === '*' || item.edata.phase === '*'))
            {
                // add extra params if there
                Object.keys(item.edata).forEach(key => {
                    if (edata[key] == null && item.edata[key] != null) {
                        edata[key] = item.edata[key]
                    }
                })
                // check handler arguments
                args = []
                tmp  = new RegExp(/\((.*?)\)/).exec(String(item.handler).split('=>')[0])
                if (tmp) args = tmp[1].split(/\s*,\s*/)
                if (args.length === 2) {
                    item.handler.call(this, edata.target, edata) // old way for back compatibility
                    if (this.debug) console.log(` - call (old)`, item.handler)
                } else {
                    item.handler.call(this, edata) // new way
                    if (this.debug) console.log(` - call`, item.handler)
                }
                if (edata.isStopped === true || edata.stop === true) return edata // back compatibility edata.stop === true
            }
        }
        // main object events
        let funName = 'on' + edata.type.substr(0,1).toUpperCase() + edata.type.substr(1)
        if (edata.phase === 'before' && typeof this[funName] === 'function') {
            fun = this[funName]
            // check handler arguments
            args = []
            tmp  = new RegExp(/\((.*?)\)/).exec(String(fun).split('=>')[0])
            if (tmp) args = tmp[1].split(/\s*,\s*/)
            if (args.length === 2) {
                fun.call(this, edata.target, edata) // old way for back compatibility
                if (this.debug) console.log(` - call: on[Event] (old)`, fun)
            } else {
                fun.call(this, edata) // new way
                if (this.debug) console.log(` - call: on[Event]`, fun)
            }
            if (edata.isStopped === true || edata.stop === true) return edata // back compatibility edata.stop === true
        }
        // item object events
        if (edata.object != null && edata.phase === 'before' && typeof edata.object[funName] === 'function') {
            fun = edata.object[funName]
            // check handler arguments
            args = []
            tmp  = new RegExp(/\((.*?)\)/).exec(String(fun).split('=>')[0])
            if (tmp) args = tmp[1].split(/\s*,\s*/)
            if (args.length === 2) {
                fun.call(this, edata.target, edata) // old way for back compatibility
                if (this.debug) console.log(` - call: edata.object (old)`, fun)
            } else {
                fun.call(this, edata) // new way
                if (this.debug) console.log(` - call: edata.object`, fun)
            }
            if (edata.isStopped === true || edata.stop === true) return edata
        }
        // execute onComplete
        if (edata.phase === 'after') {
            if (typeof edata.onComplete === 'function') edata.onComplete.call(this, edata)
            for (let i = 0; i < edata.doneHandlers.length; i++) {
                if (typeof edata.doneHandlers[i] === 'function') {
                    edata.doneHandlers[i].call(this, edata)
                    if (this.debug) console.log(` - call: done`, fun)
                }
            }
            edata._resolve(edata)
            if (this.debug) {
                console.log(`w2base: trigger "${edata.type}:${edata.phase}"`, edata)
            }
        }
        return edata
    }
}
/**
 * Part of w2ui 2.0 library
 *  - Dependencies: none
 *
 * These are the master locale settings that will be used by w2utils
 *
 * "locale" should be the IETF language tag in the form xx-YY,
 * where xx is the ISO 639-1 language code ( see https://en.wikipedia.org/wiki/ISO_639-1 ) and
 * YY is the ISO 3166-1 alpha-2 country code ( see https://en.wikipedia.org/wiki/ISO_3166-2 )
 */
const w2locale = {
    'locale'            : 'en-US',
    'dateFormat'        : 'm/d/yyyy',
    'timeFormat'        : 'hh:mi pm',
    'datetimeFormat'    : 'm/d/yyyy|hh:mi pm',
    'currencyPrefix'    : '$',
    'currencySuffix'    : '',
    'currencyPrecision' : 2,
    'groupSymbol'       : ',', // aka "thousands separator"
    'decimalSymbol'     : '.',
    'shortmonths'       : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    'fullmonths'        : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    'shortdays'         : ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    'fulldays'          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    'weekStarts'        : 'S', // can be "M" for Monday or "S" for Sunday
    // phrases used in w2ui, should be empty for original language
    // keep these up-to-date and in sorted order
    // value = "---" to easier see what to translate
    'phrases': {
        '${count} letters or more...': '---',
        'Add new record': '---',
        'Add New': '---',
        'Advanced Search': '---',
        'after': '---',
        'AJAX error. See console for more details.': '---',
        'All Fields': '---',
        'All': '---',
        'Any': '---',
        'Are you sure you want to delete ${count} ${records}?': '---',
        'Attach files by dragging and dropping or Click to Select': '---',
        'before': '---',
        'begins with': '---',
        'begins': '---',
        'between': '---',
        'buffered': '---',
        'Cancel': '---',
        'Close': '---',
        'Column': '---',
        'Confirmation': '---',
        'contains': '---',
        'Copied': '---',
        'Copy to clipboard': '---',
        'Current Date & Time': '---',
        'Delete selected records': '---',
        'Delete': '---',
        'Do you want to delete search item "${item}"?': '---',
        'Edit selected record': '---',
        'Edit': '---',
        'Empty list': '---',
        'ends with': '---',
        'ends': '---',
        'Field should be at least ${count} characters.': '---',
        'Hide': '---',
        'in': '---',
        'is not': '---',
        'is': '---',
        'less than': '---',
        'Line #': '---',
        'Load ${count} more...': '---',
        'Loading...': '---',
        'Maximum number of files is ${count}': '---',
        'Maximum total size is ${count}': '---',
        'Modified': '---',
        'more than': '---',
        'Multiple Fields': '---',
        'Name': '---',
        'No items found': '---',
        'No matches': '---',
        'No': '---',
        'none': '---',
        'Not a float': '---',
        'Not a hex number': '---',
        'Not a valid date': '---',
        'Not a valid email': '---',
        'Not alpha-numeric': '---',
        'Not an integer': '---',
        'Not in money format': '---',
        'not in': '---',
        'Notification': '---',
        'of': '---',
        'Ok': '---',
        'Opacity': '---',
        'Record ID': '---',
        'record': '---',
        'records': '---',
        'Refreshing...': '---',
        'Reload data in the list': '---',
        'Remove': '---',
        'Request aborted.': '---',
        'Required field': '---',
        'Reset': '---',
        'Restore Default State': '---',
        'Returned data is not in valid JSON format.': '---',
        'Save changed records': '---',
        'Save Grid State': '---',
        'Save': '---',
        'Saved Searches': '---',
        'Saving...': '---',
        'Search took ${count} seconds': '---',
        'Search': '---',
        'Select Hour': '---',
        'Select Minute': '---',
        'selected': '---',
        'Server Response ${count} seconds': '---',
        'Show/hide columns': '---',
        'Show': '---',
        'Size': '---',
        'Skip': '---',
        'Sorting took ${count} seconds': '---',
        'Type to search...': '---',
        'Type': '---',
        'Yes': '---',
        'Yesterday': '---',
        'Your remote data source record count has changed, reloading from the first record.': '---'
    }
}
class Query {
    constructor(selector, context, previous) {
        this.version = 0.4
        this.context = context ?? document
        this.previous = previous ?? null
        let nodes = []
        if (Array.isArray(selector)) {
            nodes = selector
        } else if (Query._isEl(selector)) {
            nodes = [selector]
        } else if (selector instanceof Query) {
            nodes = selector.nodes
        } else if (typeof selector == 'string') {
            if (typeof this.context.querySelector != 'function') {
                throw new Error('Invalid context')
            }
            nodes = Array.from(this.context.querySelectorAll(selector))
        } else if (selector == null) {
            nodes = []
        } else {
            // if selector is itterable, then try to create nodes from it, also supports jQuery
            let arr = Array.from(selector ?? [])
            if (typeof selector == 'object' && Array.isArray(arr)) {
                nodes = arr
            } else {
                throw new Error(`Invalid selector "${selector}"`)
            }
        }
        this.nodes = nodes
        this.length = nodes.length
        // map nodes to object propoerties
        this.each((node, ind) => {
            this[ind] = node
        })
    }
    static _isEl(node) {
        return (node instanceof Document || node instanceof DocumentFragment
            || node instanceof HTMLElement || node instanceof Text)
    }
    static _fragment(html) {
        let tmpl = document.createElement('template')
        tmpl.innerHTML = html
        return tmpl.content
    }
    _insert(method, html) {
        let nodes = []
        let len  = this.length
        if (len < 1) return
        let isEl = Query._isEl(html)
        let self = this
        // TODO: need good unit test coverage for this function
        if (typeof html == 'string') {
            this.each(node => {
                let clone = Query._fragment(html)
                nodes.push(...clone.childNodes)
                node[method](clone)
            })
        } else if (html instanceof Query) {
            let single = (len == 1 && html.length == 1)
            html.each(el => {
                this.each(node => {
                    // if insert before a single node, just move new one, else clone and move it
                    let clone = (single ? el : el.cloneNode(true))
                    node[method](clone)
                    nodes.push(clone)
                })
            })
            if (!single) html.remove()
        } else if (isEl) {
            this.each(node => {
                // if insert before a single node, just move new one, else clone and move it
                let clone = (len === 1 ? html : Query._fragment(html.outerHTML))
                nodes.push(...(len === 1 ? [html] : clone.childNodes))
                node[method](clone)
            })
            if (len > 1) html.remove()
        } else {
            throw new Error(`Incorrect argument for "${method}(html)". It expects one string argument.`)
        }
        if (method == 'replaceWith') {
            self = new Query(nodes, this.context, this) // must return a new collection
        }
        return self
    }
    _save(node, name, value) {
        node._mQuery = node._mQuery ?? {}
        if (Array.isArray(value)) {
            node._mQuery[name] = node._mQuery[name] ?? []
            node._mQuery[name].push(...value)
        } else if (value != null) {
            node._mQuery[name] = value
        } else {
            delete node._mQuery[name];
        }
    }
    get(index) {
        if (index < 0) index = this.length + index
        let node = this[index]
        if (node) {
            return node
        }
        if (index != null) {
            return null
        }
        return this.nodes
    }
    eq(index) {
        if (index < 0) index = this.length + index
        let nodes = [this[index]]
        if (nodes[0] == null) nodes = []
        return new Query(nodes, this.context, this) // must return a new collection
    }
    then(fun) {
        let ret = fun(this)
        return ret != null ? ret : this
    }
    find(selector) {
        let nodes = []
        this.each(node => {
            let nn = Array.from(node.querySelectorAll(selector))
            if (nn.length > 0) {
                nodes.push(...nn)
            }
        })
        return new Query(nodes, this.context, this) // must return a new collection
    }
    filter(selector) {
        let nodes = []
        this.each(node => {
            if (node === selector
                || (typeof selector == 'string' && node.matches && node.matches(selector))
                || (typeof selector == 'function' && selector(node))
            ) {
                nodes.push(node)
            }
        })
        return new Query(nodes, this.context, this) // must return a new collection
    }
    shadow(selector) {
        let nodes = []
        this.each(node => {
            // select shadow root if available
            if (node.shadowRoot) nodes.push(node.shadowRoot)
        })
        let col = new Query(nodes, this.context, this)
        return selector ? col.find(selector) : col
    }
    closest(selector) {
        let nodes = []
        this.each(node => {
            let nn = node.closest(selector)
            if (nn) {
                nodes.push(nn)
            }
        })
        return new Query(nodes, this.context, this) // must return a new collection
    }
    host(all) {
        let nodes = []
        // find shadow root or body
        let top = (node) => {
            if (node.parentNode) {
                return top(node.parentNode)
            } else {
                return node
            }
        }
        let fun = (node) => {
            let nn = top(node)
            nodes.push(nn.host ? nn.host : nn)
            if (nn.host && all) fun(nn.host)
        }
        this.each(node => {
            fun(node)
        })
        return new Query(nodes, this.context, this) // must return a new collection
    }
    parent(selector) {
        return this.parents(selector, true)
    }
    parents(selector, firstOnly) {
        let nodes = []
        let add = (node) => {
            if (nodes.indexOf(node) == -1) {
                nodes.push(node)
            }
            if (!firstOnly && node.parentNode) {
                return add(node.parentNode)
            }
        }
        this.each(node => {
            if (node.parentNode) add(node.parentNode)
        })
        let col = new Query(nodes, this.context, this)
        return selector ? col.filter(selector) : col
    }
    each(func) {
        this.nodes.forEach((node, ind) => { func(node, ind, this) })
        return this
    }
    append(html) {
        return this._insert('append', html)
    }
    prepend(html) {
        return this._insert('prepend', html)
    }
    after(html) {
        return this._insert('after', html)
    }
    before(html) {
        return this._insert('before', html)
    }
    replace(html) {
        return this._insert('replaceWith', html)
    }
    remove() {
        // remove from dom, but keep in current query
        this.each(node => { node.remove() })
        return this
    }
    css(key, value) {
        let css = key
        let len = arguments.length
        if (len === 0 || (len ===1 && typeof key == 'string')) {
            if (this[0]) {
                // do not do computedStyleMap as it is not what on immediate element
                if (typeof key == 'string') {
                    return this[0].style[key]
                } else {
                    return Object.fromEntries(
                        this[0].style.cssText
                            .split(';')
                            .filter(a => !!a) // filter non-empty
                            .map(a => {
                                return a.split(':').map(a => a.trim()) // trim strings
                            })
                        )
                }
            } else {
                return undefined
            }
        } else {
            if (typeof key != 'object') {
                css = {}
                css[key] = value
            }
            this.each((el, ind) => {
                Object.keys(css).forEach(key => {
                    el.style[key] = css[key]
                })
            })
            return this
        }
    }
    addClass(classes) {
        this.toggleClass(classes, true)
        return this
    }
    removeClass(classes) {
        this.toggleClass(classes, false)
        return this
    }
    toggleClass(classes, force) {
        // split by comma or space
        if (typeof classes == 'string') classes = classes.split(/[,\s]+/)
        this.each(node => {
            let classes2 = classes
            // if not defined, remove all classes
            if (classes2 == null && force === false) classes2 = Array.from(node.classList)
            classes2.forEach(className => {
                if (className !== '') {
                    let act = 'toggle'
                    if (force != null) act = force ? 'add' : 'remove'
                    node.classList[act](className)
                }
            })
        })
        return this
    }
    hasClass(classes) {
        // split by comma or space
        if (typeof classes == 'string') classes = classes.split(/[,\s]+/)
        if (classes == null && this.length > 0) {
            return Array.from(this[0].classList)
        }
        let ret = false
        this.each(node => {
            ret = ret || classes.every(className => {
                return Array.from(node.classList).includes(className)
            })
        })
        return ret
    }
    on(events, options, callback) {
        if (typeof options == 'function') {
            callback = options
            options = undefined
        }
        let delegate
        if (options?.delegate) {
            delegate = options.delegate
            delete options.delegate // not to pass to addEventListener
        }
        events = events.split(/[,\s]+/) // separate by comma or space
        events.forEach(eventName => {
            let [ event, scope ] = String(eventName).toLowerCase().split('.')
            if (delegate) {
                let fun = callback
                callback = (event) => {
                    // event.target or any ancestors match delegate selector
                    let parent = query(event.target).parents(delegate)
                    if (parent.length > 0) { event.delegate = parent[0] } else { event.delegate = event.target }
                    if (event.target.matches(delegate) || parent.length > 0) {
                        fun(event)
                    }
                }
            }
            this.each(node => {
                this._save(node, 'events', [{ event, scope, callback, options }])
                node.addEventListener(event, callback, options)
            })
        })
        return this
    }
    off(events, options, callback) {
        if (typeof options == 'function') {
            callback = options
            options = undefined
        }
        events = events.split(/[,\s]+/) // separate by comma or space
        events.forEach(eventName => {
            let [ event, scope ] = String(eventName).toLowerCase().split('.')
            this.each(node => {
                if (Array.isArray(node._mQuery?.events)) {
                    for (let i = node._mQuery.events.length - 1; i >= 0; i--) {
                        let evt = node._mQuery.events[i]
                        if (scope == null || scope === '') {
                            // if no scope, has to be exact match
                            if (evt.event == event && evt.scope == scope && (evt.callback == callback || callback == null)) {
                                node.removeEventListener(event, evt.callback, evt.options)
                                node._mQuery.events.splice(i, 1)
                            }
                        } else {
                            if ((evt.event == event || event === '') && (evt.scope == scope || scope === '*')) {
                                node.removeEventListener(evt.event, evt.callback, evt.options)
                                node._mQuery.events.splice(i, 1)
                            }
                        }
                    }
                }
            })
        })
        return this
    }
    trigger(name, options) {
        let event,
            mevent = ['click', 'dblclick', 'mousedown', 'mouseup', 'mousemove'],
            kevent = ['keydown', 'keyup', 'keypress']
        if (name instanceof Event || name instanceof CustomEvent) {
            // MouseEvent and KeyboardEvent are instances of Event, no need to explicitly add
            event = name
        } else if (mevent.includes(name)) {
            event = new MouseEvent(name, options)
        } else if (kevent.includes(name)) {
            event = new KeyboardEvent(name, options)
        } else {
            event = new Event(name, options)
        }
        this.each(node => { node.dispatchEvent(event) })
        return this
    }
    attr(name, value) {
        if (value === undefined && typeof name == 'string') {
            return this[0] ? this[0].getAttribute(name) : undefined
        } else {
            let obj = {}
            if (typeof name == 'object') obj = name; else obj[name] = value
            this.each(node => {
                Object.entries(obj).forEach(([nm, val]) => { node.setAttribute(nm, val) })
            })
            return this
        }
    }
    removeAttr() {
        this.each(node => {
            Array.from(arguments).forEach(attr => {
                node.removeAttribute(attr)
            })
        })
        return this
    }
    prop(name, value) {
        if (value === undefined && typeof name == 'string') {
            return this[0] ? this[0][name] : undefined
        } else {
            let obj = {}
            if (typeof name == 'object') obj = name; else obj[name] = value
            this.each(node => {
                Object.entries(obj).forEach(([nm, val]) => { node[nm] = val })
            })
            return this
        }
    }
    removeProp() {
        this.each(node => {
            Array.from(arguments).forEach(prop => { delete node[prop] })
        })
        return this
    }
    data(key, value) {
        if (key && key.indexOf('-') != -1) {
            console.error(`Key "${key}" contains "-" (dash). Dashes are not allowed in property names. Use camelCase instead.`)
        }
        if (arguments.length < 2) {
            if (this[0]) {
                let data = Object.assign({}, this[0].dataset)
                Object.keys(data).forEach(key => {
                    if (data[key].startsWith('[') || data[key].startsWith('{')) {
                        try { data[key] = JSON.parse(data[key]) } catch(e) {}
                    }
                })
                return key ? data[key] : data
            } else {
                return undefined
            }
        } else {
            this.each(node => {
                if (value != null) {
                    node.dataset[key] = value instanceof Object ? JSON.stringify(value) : value
                } else {
                    delete node.dataset[key]
                }
            })
            return this
        }
    }
    removeData(key) {
        this.each(node => {
            delete node.dataset[key]
        })
        return this
    }
    show() {
        return this.toggle(true)
    }
    hide() {
        return this.toggle(false)
    }
    toggle(force) {
        return this.each(node => {
            let dsp = node.style.display
            if ((dsp == 'none' && force == null) || force === true) { // show
                node.style.display = node._mQuery?.prevDisplay ?? ''
                this._save(node, 'prevDisplay', null)
            } else { // hide
                if (dsp != 'none') this._save(node, 'prevDisplay', dsp)
                node.style.display = 'none'
            }
        })
    }
    empty() {
        return this.html('')
    }
    html(html) {
        return this.prop('innerHTML', html)
    }
    text(text) {
        return this.prop('textContent', text)
    }
    val(value) {
        return this.prop('value', value) // must be prop
    }
    change() {
        return this.trigger('change')
    }
    click() {
        return this.trigger('click')
    }
}
// create a new object each time
let query = function (selector, context) {
    // if a function, use as onload event
    if (typeof selector == 'function') {
        window.addEventListener('load', selector)
    } else {
        return new Query(selector, context)
    }
}
// str -> doc-fragment
query.html = (str) => { let frag = Query._fragment(str); return query(frag.children, frag)  }
/**
 * Part of w2ui 2.0 library
 *  - Dependencies: mQuery, w2utils, w2base, w2locale
 *
 * == TODO ==
 *  - overlay should be displayed where more space (on top or on bottom)
 *  - add maxHeight for the w2menu
 *  - add w2utils.lang wrap for all captions in all buttons.
 *  - message.options - should have actions
 *  - cssPrefix should be deprecated
 *  - check transition (also with layout)
 *
 * == 2.0 changes
 *  - CSP - fixed inline events
 *  - transition returns a promise
 *  - nearly removed jQuery (toolip has reference)
 *  - refactores w2utils.message()
 *  - added w2utils.confirm()
 *  - added isPlainObject
 *  - added stripSpaces
 */

// variable that holds all w2ui objects
let w2ui = {}
class Utils {
    constructor () {
        this.version = '2.0.x'
        this.tmp = {}
        this.settings = this.extend({}, {
            'dataType'       : 'HTTPJSON', // can be HTTP, HTTPJSON, RESTFULL, RESTFULLJSON, JSON (case sensitive)
            'dateStartYear'  : 1950,  // start year for date-picker
            'dateEndYear'    : 2030,  // end year for date picker
            'macButtonOrder' : false, // if true, Yes on the right side
            'warnNoPhrase'   : false,  // call console.warn if lang() encounters a missing phrase
        }, w2locale, { phrases: null }), // if there are no phrases, then it is original language
        this.i18nCompare = Intl.Collator().compare
        this.hasLocalStorage = testLocalStorage()
        // some internal variables
        this.isMac = /Mac/i.test(navigator.platform)
        this.isMobile = /(iphone|ipod|ipad|mobile|android)/i.test(navigator.userAgent)
        this.isIOS = /(iphone|ipod|ipad)/i.test(navigator.platform)
        this.isAndroid = /(android)/i.test(navigator.userAgent)
        this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        // Formatters: Primarily used in grid
        this.formatters = {
            'number'(value, params) {
                if (parseInt(params) > 20) params = 20
                if (parseInt(params) < 0) params = 0
                if (value == null || value === '') return ''
                return w2utils.formatNumber(parseFloat(value), params, true)
            },
            'float'(value, params) {
                return w2utils.formatters.number(value, params)
            },
            'int'(value, params) {
                return w2utils.formatters.number(value, 0)
            },
            'money'(value, params) {
                if (value == null || value === '') return ''
                let data = w2utils.formatNumber(Number(value), w2utils.settings.currencyPrecision)
                return (w2utils.settings.currencyPrefix || '') + data + (w2utils.settings.currencySuffix || '')
            },
            'currency'(value, params) {
                return w2utils.formatters.money(value, params)
            },
            'percent'(value, params) {
                if (value == null || value === '') return ''
                return w2utils.formatNumber(value, params || 1) + '%'
            },
            'size'(value, params) {
                if (value == null || value === '') return ''
                return w2utils.formatSize(parseInt(value))
            },
            'date'(value, params) {
                if (params === '') params = w2utils.settings.dateFormat
                if (value == null || value === 0 || value === '') return ''
                let dt = w2utils.isDateTime(value, params, true)
                if (dt === false) dt = w2utils.isDate(value, params, true)
                return '<span title="'+ dt +'">' + w2utils.formatDate(dt, params) + '</span>'
            },
            'datetime'(value, params) {
                if (params === '') params = w2utils.settings.datetimeFormat
                if (value == null || value === 0 || value === '') return ''
                let dt = w2utils.isDateTime(value, params, true)
                if (dt === false) dt = w2utils.isDate(value, params, true)
                return '<span title="'+ dt +'">' + w2utils.formatDateTime(dt, params) + '</span>'
            },
            'time'(value, params) {
                if (params === '') params = w2utils.settings.timeFormat
                if (params === 'h12') params = 'hh:mi pm'
                if (params === 'h24') params = 'h24:mi'
                if (value == null || value === 0 || value === '') return ''
                let dt = w2utils.isDateTime(value, params, true)
                if (dt === false) dt = w2utils.isDate(value, params, true)
                return '<span title="'+ dt +'">' + w2utils.formatTime(value, params) + '</span>'
            },
            'timestamp'(value, params) {
                if (params === '') params = w2utils.settings.datetimeFormat
                if (value == null || value === 0 || value === '') return ''
                let dt = w2utils.isDateTime(value, params, true)
                if (dt === false) dt = w2utils.isDate(value, params, true)
                return dt.toString ? dt.toString() : ''
            },
            'gmt'(value, params) {
                if (params === '') params = w2utils.settings.datetimeFormat
                if (value == null || value === 0 || value === '') return ''
                let dt = w2utils.isDateTime(value, params, true)
                if (dt === false) dt = w2utils.isDate(value, params, true)
                return dt.toUTCString ? dt.toUTCString() : ''
            },
            'age'(value, params) {
                if (value == null || value === 0 || value === '') return ''
                let dt = w2utils.isDateTime(value, null, true)
                if (dt === false) dt = w2utils.isDate(value, null, true)
                return '<span title="'+ dt +'">' + w2utils.age(value) + (params ? (' ' + params) : '') + '</span>'
            },
            'interval'(value, params) {
                if (value == null || value === 0 || value === '') return ''
                return w2utils.interval(value) + (params ? (' ' + params) : '')
            },
            'toggle'(value, params) {
                return (value ? 'Yes' : '')
            },
            'password'(value, params) {
                let ret = ''
                for (let i = 0; i < value.length; i++) {
                    ret += '*'
                }
                return ret
            }
        }
        return
        function testLocalStorage() {
            // test if localStorage is available, see issue #1282
            let str = 'w2ui_test'
            try {
                localStorage.setItem(str, str)
                localStorage.removeItem(str)
                return true
            } catch (e) {
                return false
            }
        }
    }
    isBin(val) {
        let re = /^[0-1]+$/
        return re.test(val)
    }
    isInt(val) {
        let re = /^[-+]?[0-9]+$/
        return re.test(val)
    }
    isFloat(val) {
        if (typeof val === 'string') {
            val = val.replace(this.settings.groupSymbol, '')
                     .replace(this.settings.decimalSymbol, '.')
        }
        return (typeof val === 'number' || (typeof val === 'string' && val !== '')) && !isNaN(Number(val))
    }
    isMoney(val) {
        if (typeof val === 'object' || val === '') return false
        if (this.isFloat(val)) return true
        let se = this.settings
        let re = new RegExp('^'+ (se.currencyPrefix ? '\\' + se.currencyPrefix + '?' : '') +
                            '[-+]?'+ (se.currencyPrefix ? '\\' + se.currencyPrefix + '?' : '') +
                            '[0-9]*[\\'+ se.decimalSymbol +']?[0-9]+'+ (se.currencySuffix ? '\\' + se.currencySuffix + '?' : '') +'$', 'i')
        if (typeof val === 'string') {
            val = val.replace(new RegExp(se.groupSymbol, 'g'), '')
        }
        return re.test(val)
    }
    isHex(val) {
        let re = /^(0x)?[0-9a-fA-F]+$/
        return re.test(val)
    }
    isAlphaNumeric(val) {
        let re = /^[a-zA-Z0-9_-]+$/
        return re.test(val)
    }
    isEmail(val) {
        let email = /^[a-zA-Z0-9._%\-+]+@[а-яА-Яa-zA-Z0-9.-]+\.[а-яА-Яa-zA-Z]+$/
        return email.test(val)
    }
    isIpAddress(val) {
        let re = new RegExp('^' +
                            '((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}' +
                            '(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)' +
                            '$')
        return re.test(val)
    }
    isDate(val, format, retDate) {
        if (!val) return false
        let dt = 'Invalid Date'
        let month, day, year
        if (format == null) format = this.settings.dateFormat
        if (typeof val.getFullYear === 'function') { // date object
            year  = val.getFullYear()
            month = val.getMonth() + 1
            day   = val.getDate()
        } else if (parseInt(val) == val && parseInt(val) > 0) {
            val   = new Date(parseInt(val))
            year  = val.getFullYear()
            month = val.getMonth() + 1
            day   = val.getDate()
        } else {
            val = String(val)
            // convert month formats
            if (new RegExp('mon', 'ig').test(format)) {
                format = format.replace(/month/ig, 'm').replace(/mon/ig, 'm').replace(/dd/ig, 'd').replace(/[, ]/ig, '/').replace(/\/\//g, '/').toLowerCase()
                val    = val.replace(/[, ]/ig, '/').replace(/\/\//g, '/').toLowerCase()
                for (let m = 0, len = this.settings.fullmonths.length; m < len; m++) {
                    let t = this.settings.fullmonths[m]
                    val   = val.replace(new RegExp(t, 'ig'), (parseInt(m) + 1)).replace(new RegExp(t.substr(0, 3), 'ig'), (parseInt(m) + 1))
                }
            }
            // format date
            let tmp  = val.replace(/-/g, '/').replace(/\./g, '/').toLowerCase().split('/')
            let tmp2 = format.replace(/-/g, '/').replace(/\./g, '/').toLowerCase()
            if (tmp2 === 'mm/dd/yyyy') { month = tmp[0]; day = tmp[1]; year = tmp[2] }
            if (tmp2 === 'm/d/yyyy') { month = tmp[0]; day = tmp[1]; year = tmp[2] }
            if (tmp2 === 'dd/mm/yyyy') { month = tmp[1]; day = tmp[0]; year = tmp[2] }
            if (tmp2 === 'd/m/yyyy') { month = tmp[1]; day = tmp[0]; year = tmp[2] }
            if (tmp2 === 'yyyy/dd/mm') { month = tmp[2]; day = tmp[1]; year = tmp[0] }
            if (tmp2 === 'yyyy/d/m') { month = tmp[2]; day = tmp[1]; year = tmp[0] }
            if (tmp2 === 'yyyy/mm/dd') { month = tmp[1]; day = tmp[2]; year = tmp[0] }
            if (tmp2 === 'yyyy/m/d') { month = tmp[1]; day = tmp[2]; year = tmp[0] }
            if (tmp2 === 'mm/dd/yy') { month = tmp[0]; day = tmp[1]; year = tmp[2] }
            if (tmp2 === 'm/d/yy') { month = tmp[0]; day = tmp[1]; year = parseInt(tmp[2]) + 1900 }
            if (tmp2 === 'dd/mm/yy') { month = tmp[1]; day = tmp[0]; year = parseInt(tmp[2]) + 1900 }
            if (tmp2 === 'd/m/yy') { month = tmp[1]; day = tmp[0]; year = parseInt(tmp[2]) + 1900 }
            if (tmp2 === 'yy/dd/mm') { month = tmp[2]; day = tmp[1]; year = parseInt(tmp[0]) + 1900 }
            if (tmp2 === 'yy/d/m') { month = tmp[2]; day = tmp[1]; year = parseInt(tmp[0]) + 1900 }
            if (tmp2 === 'yy/mm/dd') { month = tmp[1]; day = tmp[2]; year = parseInt(tmp[0]) + 1900 }
            if (tmp2 === 'yy/m/d') { month = tmp[1]; day = tmp[2]; year = parseInt(tmp[0]) + 1900 }
        }
        if (!this.isInt(year)) return false
        if (!this.isInt(month)) return false
        if (!this.isInt(day)) return false
        year  = +year
        month = +month
        day   = +day
        dt    = new Date(year, month - 1, day)
        dt.setFullYear(year)
        // do checks
        if (month == null) return false
        if (String(dt) === 'Invalid Date') return false
        if ((dt.getMonth() + 1 !== month) || (dt.getDate() !== day) || (dt.getFullYear() !== year)) return false
        if (retDate === true) return dt; else return true
    }
    isTime(val, retTime) {
        // Both formats 10:20pm and 22:20
        if (val == null) return false
        let max, am, pm
        // -- process american format
        val      = String(val)
        val      = val.toUpperCase()
        am       = val.indexOf('AM') >= 0
        pm       = val.indexOf('PM') >= 0
        let ampm = (pm || am)
        if (ampm) max = 12; else max = 24
        val = val.replace('AM', '').replace('PM', '').trim()
        // ---
        let tmp = val.split(':')
        let h   = parseInt(tmp[0] || 0), m = parseInt(tmp[1] || 0), s = parseInt(tmp[2] || 0)
        // accept edge case: 3PM is a good timestamp, but 3 (without AM or PM) is NOT:
        if ((!ampm || tmp.length !== 1) && tmp.length !== 2 && tmp.length !== 3) { return false }
        if (tmp[0] === '' || h < 0 || h > max || !this.isInt(tmp[0]) || tmp[0].length > 2) { return false }
        if (tmp.length > 1 && (tmp[1] === '' || m < 0 || m > 59 || !this.isInt(tmp[1]) || tmp[1].length !== 2)) { return false }
        if (tmp.length > 2 && (tmp[2] === '' || s < 0 || s > 59 || !this.isInt(tmp[2]) || tmp[2].length !== 2)) { return false }
        // check the edge cases: 12:01AM is ok, as is 12:01PM, but 24:01 is NOT ok while 24:00 is (midnight; equivalent to 00:00).
        // meanwhile, there is 00:00 which is ok, but 0AM nor 0PM are okay, while 0:01AM and 0:00AM are.
        if (!ampm && max === h && (m !== 0 || s !== 0)) { return false }
        if (ampm && tmp.length === 1 && h === 0) { return false }
        if (retTime === true) {
            if (pm && h !== 12) h += 12 // 12:00pm - is noon
            if (am && h === 12) h += 12 // 12:00am - is midnight
            return {
                hours: h,
                minutes: m,
                seconds: s
            }
        }
        return true
    }
    isDateTime(val, format, retDate) {
        if (typeof val.getFullYear === 'function') { // date object
            if (retDate !== true) return true
            return val
        }
        let intVal = parseInt(val)
        if (intVal === val) {
            if (intVal < 0) return false
            else if (retDate !== true) return true
            else return new Date(intVal)
        }
        let tmp = String(val).indexOf(' ')
        if (tmp < 0) {
            if (String(val).indexOf('T') < 0 || String(new Date(val)) == 'Invalid Date') return false
            else if (retDate !== true) return true
            else return new Date(val)
        } else {
            if (format == null) format = this.settings.datetimeFormat
            let formats = format.split('|')
            let values  = [val.substr(0, tmp), val.substr(tmp).trim()]
            formats[0]  = formats[0].trim()
            if (formats[1]) formats[1] = formats[1].trim()
            // check
            let tmp1 = this.isDate(values[0], formats[0], true)
            let tmp2 = this.isTime(values[1], true)
            if (tmp1 !== false && tmp2 !== false) {
                if (retDate !== true) return true
                tmp1.setHours(tmp2.hours)
                tmp1.setMinutes(tmp2.minutes)
                tmp1.setSeconds(tmp2.seconds)
                return tmp1
            } else {
                return false
            }
        }
    }
    age(dateStr) {
        let d1
        if (dateStr === '' || dateStr == null) return ''
        if (typeof dateStr.getFullYear === 'function') { // date object
            d1 = dateStr
        } else if (parseInt(dateStr) == dateStr && parseInt(dateStr) > 0) {
            d1 = new Date(parseInt(dateStr))
        } else {
            d1 = new Date(dateStr)
        }
        if (String(d1) === 'Invalid Date') return ''
        let d2     = new Date()
        let sec    = (d2.getTime() - d1.getTime()) / 1000
        let amount = ''
        let type   = ''
        if (sec < 0) {
            amount = 0
            type   = 'sec'
        } else if (sec < 60) {
            amount = Math.floor(sec)
            type   = 'sec'
            if (sec < 0) { amount = 0; type = 'sec' }
        } else if (sec < 60*60) {
            amount = Math.floor(sec/60)
            type   = 'min'
        } else if (sec < 24*60*60) {
            amount = Math.floor(sec/60/60)
            type   = 'hour'
        } else if (sec < 30*24*60*60) {
            amount = Math.floor(sec/24/60/60)
            type   = 'day'
        } else if (sec < 365*24*60*60) {
            amount = Math.floor(sec/30/24/60/60*10)/10
            type   = 'month'
        } else if (sec < 365*4*24*60*60) {
            amount = Math.floor(sec/365/24/60/60*10)/10
            type   = 'year'
        } else if (sec >= 365*4*24*60*60) {
            // factor in leap year shift (only older then 4 years)
            amount = Math.floor(sec/365.25/24/60/60*10)/10
            type   = 'year'
        }
        return amount + ' ' + type + (amount > 1 ? 's' : '')
    }
    interval(value) {
        let ret = ''
        if (value < 100) {
            ret = '< 0.01 sec'
        } else if (value < 1000) {
            ret = (Math.floor(value / 10) / 100) + ' sec'
        } else if (value < 10000) {
            ret = (Math.floor(value / 100) / 10) + ' sec'
        } else if (value < 60000) {
            ret = Math.floor(value / 1000) + ' secs'
        } else if (value < 3600000) {
            ret = Math.floor(value / 60000) + ' mins'
        } else if (value < 86400000) {
            ret = Math.floor(value / 3600000 * 10) / 10 + ' hours'
        } else if (value < 2628000000) {
            ret = Math.floor(value / 86400000 * 10) / 10 + ' days'
        } else if (value < 3.1536e+10) {
            ret = Math.floor(value / 2628000000 * 10) / 10 + ' months'
        } else {
            ret = Math.floor(value / 3.1536e+9) / 10 + ' years'
        }
        return ret
    }
    date(dateStr) {
        if (dateStr === '' || dateStr == null || (typeof dateStr === 'object' && !dateStr.getMonth)) return ''
        let d1 = new Date(dateStr)
        if (this.isInt(dateStr)) d1 = new Date(Number(dateStr)) // for unix timestamps
        if (String(d1) === 'Invalid Date') return ''
        let months = this.settings.shortmonths
        let d2     = new Date() // today
        let d3     = new Date()
        d3.setTime(d3.getTime() - 86400000) // yesterday
        let dd1 = months[d1.getMonth()] + ' ' + d1.getDate() + ', ' + d1.getFullYear()
        let dd2 = months[d2.getMonth()] + ' ' + d2.getDate() + ', ' + d2.getFullYear()
        let dd3 = months[d3.getMonth()] + ' ' + d3.getDate() + ', ' + d3.getFullYear()
        let time  = (d1.getHours() - (d1.getHours() > 12 ? 12 :0)) + ':' + (d1.getMinutes() < 10 ? '0' : '') + d1.getMinutes() + ' ' + (d1.getHours() >= 12 ? 'pm' : 'am')
        let time2 = (d1.getHours() - (d1.getHours() > 12 ? 12 :0)) + ':' + (d1.getMinutes() < 10 ? '0' : '') + d1.getMinutes() + ':' + (d1.getSeconds() < 10 ? '0' : '') + d1.getSeconds() + ' ' + (d1.getHours() >= 12 ? 'pm' : 'am')
        let dsp   = dd1
        if (dd1 === dd2) dsp = time
        if (dd1 === dd3) dsp = this.lang('Yesterday')
        return '<span title="'+ dd1 +' ' + time2 +'">'+ dsp +'</span>'
    }
    formatSize(sizeStr) {
        if (!this.isFloat(sizeStr) || sizeStr === '') return ''
        sizeStr = parseFloat(sizeStr)
        if (sizeStr === 0) return 0
        let sizes = ['Bt', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB']
        let i     = parseInt( Math.floor( Math.log(sizeStr) / Math.log(1024) ) )
        return (Math.floor(sizeStr / Math.pow(1024, i) * 10) / 10).toFixed(i === 0 ? 0 : 1) + ' ' + (sizes[i] || '??')
    }
    formatNumber(val, fraction, useGrouping) {
        if (val == null || val === '' || typeof val === 'object') return ''
        let options = {
            minimumFractionDigits : fraction,
            maximumFractionDigits : fraction,
            useGrouping : useGrouping
        }
        if (fraction == null || fraction < 0) {
            options.minimumFractionDigits = 0
            options.maximumFractionDigits = 20
        }
        return parseFloat(val).toLocaleString(this.settings.locale, options)
    }
    formatDate(dateStr, format) { // IMPORTANT dateStr HAS TO BE valid JavaScript Date String
        if (!format) format = this.settings.dateFormat
        if (dateStr === '' || dateStr == null || (typeof dateStr === 'object' && !dateStr.getMonth)) return ''
        let dt = new Date(dateStr)
        if (this.isInt(dateStr)) dt = new Date(Number(dateStr)) // for unix timestamps
        if (String(dt) === 'Invalid Date') return ''
        let year  = dt.getFullYear()
        let month = dt.getMonth()
        let date  = dt.getDate()
        return format.toLowerCase()
            .replace('month', this.settings.fullmonths[month])
            .replace('mon', this.settings.shortmonths[month])
            .replace(/yyyy/g, ('000' + year).slice(-4))
            .replace(/yyy/g, ('000' + year).slice(-4))
            .replace(/yy/g, ('0' + year).slice(-2))
            .replace(/(^|[^a-z$])y/g, '$1' + year) // only y's that are not preceded by a letter
            .replace(/mm/g, ('0' + (month + 1)).slice(-2))
            .replace(/dd/g, ('0' + date).slice(-2))
            .replace(/th/g, (date == 1 ? 'st' : 'th'))
            .replace(/th/g, (date == 2 ? 'nd' : 'th'))
            .replace(/th/g, (date == 3 ? 'rd' : 'th'))
            .replace(/(^|[^a-z$])m/g, '$1' + (month + 1)) // only y's that are not preceded by a letter
            .replace(/(^|[^a-z$])d/g, '$1' + date) // only y's that are not preceded by a letter
    }
    formatTime(dateStr, format) { // IMPORTANT dateStr HAS TO BE valid JavaScript Date String
        if (!format) format = this.settings.timeFormat
        if (dateStr === '' || dateStr == null || (typeof dateStr === 'object' && !dateStr.getMonth)) return ''
        let dt = new Date(dateStr)
        if (this.isInt(dateStr)) dt = new Date(Number(dateStr)) // for unix timestamps
        if (this.isTime(dateStr)) {
            let tmp = this.isTime(dateStr, true)
            dt      = new Date()
            dt.setHours(tmp.hours)
            dt.setMinutes(tmp.minutes)
        }
        if (String(dt) === 'Invalid Date') return ''
        let type = 'am'
        let hour = dt.getHours()
        let h24  = dt.getHours()
        let min  = dt.getMinutes()
        let sec  = dt.getSeconds()
        if (min < 10) min = '0' + min
        if (sec < 10) sec = '0' + sec
        if (format.indexOf('am') !== -1 || format.indexOf('pm') !== -1) {
            if (hour >= 12) type = 'pm'
            if (hour > 12) hour = hour - 12
            if (hour === 0) hour = 12
        }
        return format.toLowerCase()
            .replace('am', type)
            .replace('pm', type)
            .replace('hhh', (hour < 10 ? '0' + hour : hour))
            .replace('hh24', (h24 < 10 ? '0' + h24 : h24))
            .replace('h24', h24)
            .replace('hh', hour)
            .replace('mm', min)
            .replace('mi', min)
            .replace('ss', sec)
            .replace(/(^|[^a-z$])h/g, '$1' + hour) // only y's that are not preceded by a letter
            .replace(/(^|[^a-z$])m/g, '$1' + min) // only y's that are not preceded by a letter
            .replace(/(^|[^a-z$])s/g, '$1' + sec) // only y's that are not preceded by a letter
    }
    formatDateTime(dateStr, format) {
        let fmt
        if (dateStr === '' || dateStr == null || (typeof dateStr === 'object' && !dateStr.getMonth)) return ''
        if (typeof format !== 'string') {
            fmt = [this.settings.dateFormat, this.settings.timeFormat]
        } else {
            fmt    = format.split('|')
            fmt[0] = fmt[0].trim()
            fmt[1] = (fmt.length > 1 ? fmt[1].trim() : this.settings.timeFormat)
        }
        // older formats support
        if (fmt[1] === 'h12') fmt[1] = 'h:m pm'
        if (fmt[1] === 'h24') fmt[1] = 'h24:m'
        return this.formatDate(dateStr, fmt[0]) + ' ' + this.formatTime(dateStr, fmt[1])
    }
    stripSpaces(html) {
        if (html == null) return html
        switch (typeof html) {
            case 'number':
                break
            case 'string':
                html = String(html).replace(/(?:\r\n|\r|\n)/g, '').replace(/\s\s+/g, ' ').trim()
                break
            case 'object':
                // does not modify original object, but creates a copy
                if (Array.isArray(html)) {
                    html = this.extend([], html)
                    html.forEach((key, ind) => {
                        html[ind] = this.stripSpaces(key)
                    })
                } else {
                    html = this.extend({}, html)
                    Object.keys(html).forEach(key => {
                        html[key] = this.stripSpaces(html[key])
                    })
                }
                break
        }
        return html
    }
    stripTags(html) {
        if (html == null) return html
        switch (typeof html) {
            case 'number':
                break
            case 'string':
                html = String(html).replace(/<(?:[^>=]|='[^']*'|="[^"]*"|=[^'"][^\s>]*)*>/ig, '')
                break
            case 'object':
                // does not modify original object, but creates a copy
                if (Array.isArray(html)) {
                    html = this.extend([], html)
                    html.forEach((key, ind) => {
                        html[ind] = this.stripTags(key)
                    })
                } else {
                    html = this.extend({}, html)
                    Object.keys(html).forEach(key => {
                        html[key] = this.stripTags(html[key])
                    })
                }
                break
        }
        return html
    }
    encodeTags(html) {
        if (html == null) return html
        switch (typeof html) {
            case 'number':
                break
            case 'string':
                html = String(html).replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
                break
            case 'object':
                // does not modify original object, but creates a copy
                if (Array.isArray(html)) {
                    html = this.extend([], html)
                    html.forEach((key, ind) => {
                        html[ind] = this.encodeTags(key)
                    })
                } else {
                    html = this.extend({}, html)
                    Object.keys(html).forEach(key => {
                        html[key] = this.encodeTags(html[key])
                    })
                }
                break
        }
        return html
    }
    decodeTags(html) {
        if (html == null) return html
        switch (typeof html) {
            case 'number':
                break
            case 'string':
                html = String(html).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
                break
            case 'object':
                // does not modify original object, but creates a copy
                if (Array.isArray(html)) {
                    html = this.extend([], html)
                    html.forEach((key, ind) => {
                        html[ind] = this.decodeTags(key)
                    })
                } else {
                    html = this.extend({}, html)
                    Object.keys(html).forEach(key => {
                        html[key] = this.decodeTags(html[key])
                    })
                }
                break
        }
        return html
    }
    escapeId(id) {
        // This logic is borrowed from jQuery
        if (id === '' || id == null) return ''
        let re = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g
        return (id + '').replace(re, (ch, asCodePoint) => {
            if (asCodePoint) {
                if (ch === "\0") return "\uFFFD"
                return ch.slice( 0, -1 ) + "\\" + ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " "
            }
            return "\\" + ch
        })
    }
    unescapeId(id) {
        // This logic is borrowed from jQuery
        if (id === '' || id == null) return ''
        let re = /\\[\da-fA-F]{1,6}[\x20\t\r\n\f]?|\\([^\r\n\f])/g
        return id.replace(re, (escape, nonHex) => {
            var high = "0x" + escape.slice( 1 ) - 0x10000
            return nonHex ? nonHex : high < 0
                    ? String.fromCharCode(high + 0x10000 )
                    : String.fromCharCode(high >> 10 | 0xD800, high & 0x3FF | 0xDC00)
        })
    }
    base64encode(input) {
        let output = ''
        let chr1, chr2, chr3, enc1, enc2, enc3, enc4
        let i      = 0
        let keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
        input      = utf8_encode(input)
        while (i < input.length) {
            chr1 = input.charCodeAt(i++)
            chr2 = input.charCodeAt(i++)
            chr3 = input.charCodeAt(i++)
            enc1 = chr1 >> 2
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4)
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6)
            enc4 = chr3 & 63
            if (isNaN(chr2)) {
                enc3 = enc4 = 64
            } else if (isNaN(chr3)) {
                enc4 = 64
            }
            output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) + keyStr.charAt(enc3) + keyStr.charAt(enc4)
        }
        function utf8_encode (string) {
            string      = String(string).replace(/\r\n/g,'\n')
            let utftext = ''
            for (let n = 0; n < string.length; n++) {
                let c = string.charCodeAt(n)
                if (c < 128) {
                    utftext += String.fromCharCode(c)
                }
                else if ((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192)
                    utftext += String.fromCharCode((c & 63) | 128)
                }
                else {
                    utftext += String.fromCharCode((c >> 12) | 224)
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128)
                    utftext += String.fromCharCode((c & 63) | 128)
                }
            }
            return utftext
        }
        return output
    }
    base64decode(input) {
        let output = ''
        let chr1, chr2, chr3
        let enc1, enc2, enc3, enc4
        let i      = 0
        let keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
        input      = input.replace(/[^A-Za-z0-9\+\/\=]/g, '')
        while (i < input.length) {
            enc1   = keyStr.indexOf(input.charAt(i++))
            enc2   = keyStr.indexOf(input.charAt(i++))
            enc3   = keyStr.indexOf(input.charAt(i++))
            enc4   = keyStr.indexOf(input.charAt(i++))
            chr1   = (enc1 << 2) | (enc2 >> 4)
            chr2   = ((enc2 & 15) << 4) | (enc3 >> 2)
            chr3   = ((enc3 & 3) << 6) | enc4
            output = output + String.fromCharCode(chr1)
            if (enc3 !== 64) {
                output = output + String.fromCharCode(chr2)
            }
            if (enc4 !== 64) {
                output = output + String.fromCharCode(chr3)
            }
        }
        output = utf8_decode(output)
        function utf8_decode(utftext) {
            let string = ''
            let i      = 0
            let c      = 0, c2, c3
            while ( i < utftext.length ) {
                c = utftext.charCodeAt(i)
                if (c < 128) {
                    string += String.fromCharCode(c)
                    i++
                }
                else if ((c > 191) && (c < 224)) {
                    c2      = utftext.charCodeAt(i+1)
                    string += String.fromCharCode(((c & 31) << 6) | (c2 & 63))
                    i      += 2
                }
                else {
                    c2      = utftext.charCodeAt(i+1)
                    c3      = utftext.charCodeAt(i+2)
                    string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63))
                    i      += 3
                }
            }
            return string
        }
        return output
    }
    async sha256(str) {
        const utf8 = new TextEncoder().encode(str)
        return crypto.subtle.digest('SHA-256', utf8).then((hashBuffer) => {
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            return hashArray.map((bytes) => bytes.toString(16).padStart(2, '0')).join('')
        })
    }
    transition(div_old, div_new, type, callBack) {
        return new Promise((resolve, reject) => {
            let styles = div_old.computedStyleMap()
            let width  = styles.get('width').value
            let height = styles.get('height').value
            let time   = 0.5
            if (!div_old || !div_new) {
                console.log('ERROR: Cannot do transition when one of the divs is null')
                return
            }
            div_old.parentNode.style.cssText += 'perspective: 900px; overflow: hidden;'
            div_old.style.cssText            += '; position: absolute; z-index: 1019; backface-visibility: hidden'
            div_new.style.cssText            += '; position: absolute; z-index: 1020; backface-visibility: hidden'
            switch (type) {
                case 'slide-left':
                    // init divs
                    div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0)'
                    div_new.style.cssText += 'overflow: hidden; transform: translate3d('+ width + 'px, 0, 0)'
                    query(div_new).show()
                    // -- need a timing function because otherwise not working
                    setTimeout(() => {
                        div_new.style.cssText += 'transition: '+ time +'s; transform: translate3d(0, 0, 0)'
                        div_old.style.cssText += 'transition: '+ time +'s; transform: translate3d(-'+ width +'px, 0, 0)'
                    }, 1)
                    break
                case 'slide-right':
                    // init divs
                    div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0)'
                    div_new.style.cssText += 'overflow: hidden; transform: translate3d(-'+ width +'px, 0, 0)'
                    query(div_new).show()
                    // -- need a timing function because otherwise not working
                    setTimeout(() => {
                        div_new.style.cssText += 'transition: '+ time +'s; transform: translate3d(0px, 0, 0)'
                        div_old.style.cssText += 'transition: '+ time +'s; transform: translate3d('+ width +'px, 0, 0)'
                    }, 1)
                    break
                case 'slide-down':
                    // init divs
                    div_old.style.cssText += 'overflow: hidden; z-index: 1; transform: translate3d(0, 0, 0)'
                    div_new.style.cssText += 'overflow: hidden; z-index: 0; transform: translate3d(0, 0, 0)'
                    query(div_new).show()
                    // -- need a timing function because otherwise not working
                    setTimeout(() => {
                        div_new.style.cssText += 'transition: '+ time +'s; transform: translate3d(0, 0, 0)'
                        div_old.style.cssText += 'transition: '+ time +'s; transform: translate3d(0, '+ height +'px, 0)'
                    }, 1)
                    break
                case 'slide-up':
                    // init divs
                    div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0)'
                    div_new.style.cssText += 'overflow: hidden; transform: translate3d(0, '+ height +'px, 0)'
                    query(div_new).show()
                    // -- need a timing function because otherwise not working
                    setTimeout(() => {
                        div_new.style.cssText += 'transition: '+ time +'s; transform: translate3d(0, 0, 0)'
                        div_old.style.cssText += 'transition: '+ time +'s; transform: translate3d(0, 0, 0)'
                    }, 1)
                    break
                case 'flip-left':
                    // init divs
                    div_old.style.cssText += 'overflow: hidden; transform: rotateY(0deg)'
                    div_new.style.cssText += 'overflow: hidden; transform: rotateY(-180deg)'
                    query(div_new).show()
                    // -- need a timing function because otherwise not working
                    setTimeout(() => {
                        div_new.style.cssText += 'transition: '+ time +'s; transform: rotateY(0deg)'
                        div_old.style.cssText += 'transition: '+ time +'s; transform: rotateY(180deg)'
                    }, 1)
                    break
                case 'flip-right':
                    // init divs
                    div_old.style.cssText += 'overflow: hidden; transform: rotateY(0deg)'
                    div_new.style.cssText += 'overflow: hidden; transform: rotateY(180deg)'
                    query(div_new).show()
                    // -- need a timing function because otherwise not working
                    setTimeout(() => {
                        div_new.style.cssText += 'transition: '+ time +'s; transform: rotateY(0deg)'
                        div_old.style.cssText += 'transition: '+ time +'s; transform: rotateY(-180deg)'
                    }, 1)
                    break
                case 'flip-down':
                    // init divs
                    div_old.style.cssText += 'overflow: hidden; transform: rotateX(0deg)'
                    div_new.style.cssText += 'overflow: hidden; transform: rotateX(180deg)'
                    query(div_new).show()
                    // -- need a timing function because otherwise not working
                    setTimeout(() => {
                        div_new.style.cssText += 'transition: '+ time +'s; transform: rotateX(0deg)'
                        div_old.style.cssText += 'transition: '+ time +'s; transform: rotateX(-180deg)'
                    }, 1)
                    break
                case 'flip-up':
                    // init divs
                    div_old.style.cssText += 'overflow: hidden; transform: rotateX(0deg)'
                    div_new.style.cssText += 'overflow: hidden; transform: rotateX(-180deg)'
                    query(div_new).show()
                    // -- need a timing function because otherwise not working
                    setTimeout(() => {
                        div_new.style.cssText += 'transition: '+ time +'s; transform: rotateX(0deg)'
                        div_old.style.cssText += 'transition: '+ time +'s; transform: rotateX(180deg)'
                    }, 1)
                    break
                case 'pop-in':
                    // init divs
                    div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0)'
                    div_new.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0); transform: scale(.8); opacity: 0;'
                    query(div_new).show()
                    // -- need a timing function because otherwise not working
                    setTimeout(() => {
                        div_new.style.cssText += 'transition: '+ time +'s; transform: scale(1); opacity: 1;'
                        div_old.style.cssText += 'transition: '+ time +'s;'
                    }, 1)
                    break
                case 'pop-out':
                    // init divs
                    div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0); transform: scale(1); opacity: 1;'
                    div_new.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0); opacity: 0;'
                    query(div_new).show()
                    // -- need a timing function because otherwise not working
                    setTimeout(() => {
                        div_new.style.cssText += 'transition: '+ time +'s; opacity: 1;'
                        div_old.style.cssText += 'transition: '+ time +'s; transform: scale(1.7); opacity: 0;'
                    }, 1)
                    break
                default:
                    // init divs
                    div_old.style.cssText += 'overflow: hidden; transform: translate3d(0, 0, 0)'
                    div_new.style.cssText += 'overflow: hidden; translate3d(0, 0, 0); opacity: 0;'
                    query(div_new).show()
                    // -- need a timing function because otherwise not working
                    setTimeout(() => {
                        div_new.style.cssText += 'transition: '+ time +'s; opacity: 1;'
                        div_old.style.cssText += 'transition: '+ time +'s'
                    }, 1)
                    break
            }
            setTimeout(() => {
                if (type === 'slide-down') {
                    query(div_old).css('z-index', '1019')
                    query(div_new).css('z-index', '1020')
                }
                if (div_new) {
                    query(div_new)
                        .css({ 'opacity': '1' })
                        .css({ 'transition': '', 'transform' : '' })
                }
                if (div_old) {
                    query(div_old)
                        .css({ 'opacity': '1' })
                        .css({ 'transition': '', 'transform' : '' })
                }
                if (typeof callBack === 'function') callBack()
                resolve()
            }, time * 1000)
        })
    }
    lock(box, options = {}) {
        if (box == null) return
        if (typeof options == 'string') {
            options = { msg: options }
        }
        if (arguments[2]) {
            options.spinner = arguments[2]
        }
        options = this.extend({
            // opacity: 0.3, // default comes from css
            spinner: false
        }, options)
        // for backward compatibility
        if (box && !(box instanceof HTMLElement) && box[0] instanceof HTMLElement) {
            box = Array.isArray(box) ? box : box.get()
        }
        if (!options.msg && options.msg !== 0) options.msg = ''
        this.unlock(box)
        query(box).prepend(
            '<div class="w2ui-lock"></div>'+
            '<div class="w2ui-lock-msg"></div>'
        )
        let $lock = query(box).find('.w2ui-lock')
        let $mess = query(box).find('.w2ui-lock-msg')
        if (!options.msg) {
            $mess.css({
                'background-color': 'transparent',
                'background-image': 'none',
                'border': '0px',
                'box-shadow': 'none'
            })
        }
        if (options.spinner === true) {
            options.msg = `<div class="w2ui-spinner" ${(!options.msg ? 'style="width: 35px; height: 35px"' : '')}></div>`
                + options.msg
        }
        if (options.msg) {
            $mess.html(options.msg).css('display', 'block')
        } else {
            $mess.remove()
        }
        if (options.opacity != null) {
            $lock.css('opacity', options.opacity)
        }
        $lock.css({ display: 'block' })
        if (options.bgColor) {
            $lock.css({ 'background-color': options.bgColor })
        }
        let opacity = $lock.css('opacity') || 0.3
        $lock
            .on('mousedown', function() {
                if (typeof options.onClick == 'function') {
                    options.onClick()
                } else {
                    $lock.css({
                        'transition': '.2s',
                        'opacity': opacity * 1.5
                    })
                }
            })
            .on('mouseup', function() {
                if (typeof options.onClick !== 'function') {
                    $lock.css({
                        'transition': '.2s',
                        'opacity': opacity
                    })
                }
            })
            .on('mousewheel', function(event) {
                if (event) {
                    event.stopPropagation()
                    event.preventDefault()
                }
            })
    }
    unlock(box, speed) {
        if (box == null) return
        // for backward compatibility
        if (box && !(box instanceof HTMLElement) && box[0] instanceof HTMLElement) {
            box = Array.isArray(box) ? box : box.get()
        }
        if (this.isInt(speed)) {
            query(box).find('.w2ui-lock').css({
                transition: (speed/1000) + 's',
                opacity: 0,
            })
            query(box).find('.w2ui-lock-msg').remove()
            setTimeout(() => {
                query(box).find('.w2ui-lock').remove()
            }, speed)
        } else {
            query(box).find('.w2ui-lock').remove()
            query(box).find('.w2ui-lock-msg').remove()
        }
    }
    /**
     * Opens a context message, similar in parameters as w2popup.open()
     *
     * Sample Calls
     * w2utils.message({ box: '#div' }, 'message').ok(() => {})
     * w2utils.message({ box: '#div' }, { text: 'message', width: 300 }).ok(() => {})
     * w2utils.message({ box: '#div' }, { text: 'message', actions: ['Save'] }).Save(() => {})
     *
     * Used in w2grid, w2form, w2layout (should be in w2popup too)
     * should be called with .call(...) method
     *
     * @param where = {
     *      box,     // where to open
     *      after,   // title if any, adds title heights
     *      param    // additional parameters, used in layouts for panel
     * }
     * @param options {
     *      width,      // (int), width in px, if negative, then it is maxWidth - width
     *      height,     // (int), height in px, if negative, then it is maxHeight - height
     *      text,       // centered text
     *      body,       // body of the message
     *      buttons,    // buttons of the message
     *      html,       // if body & buttons are not defined, then html is the entire message
     *      focus,      // int or id with a selector, default is 0
     *      hideOn,     // ['esc', 'click'], default is ['esc']
     *      actions,    // array of actions (only if buttons is not defined)
     *      onOpen,     // event when opened
     *      onClose,    // event when closed
     *      onAction,   // event on action
     * }
     */
    message(where, options) {
        let closeTimer, openTimer, edata
        if (typeof options == 'string') {
            options = {
                width : (options.length < 300 ? 350 : 550),
                height: (options.length < 300 ? 170: 250),
                text  : options,
            }
        }
        if (typeof options != 'object') {
            removeLast()
            return
        }
        if (options.text != null) options.body = `<div class="w2ui-centered w2ui-msg-text">${options.text}</div>`
        if (options.width == null) options.width = 350
        if (options.height == null) options.height = 170
        if (options.hideOn == null) options.hideOn = ['esc']
        // mix in events
        if (options.on == null) {
            let opts = options
            options = new w2base()
            w2utils.extend(options, opts) // needs to be w2utils
        }
        options.on('open', (event) => {
            w2utils.bindEvents(query(options.box).find('.w2ui-eaction'), options)
            query(event.detail.box).find('button, input, textarea')
                .off('.message')
                .on('keydown.message', function(evt) {
                    if (evt.keyCode == 27 && options.hideOn.includes('esc')) {
                        if (options.cancelAction) {
                            options.action(options.cancelAction)
                        } else {
                            options.close()
                        }
                    }
                })
            options.setFocus(options.focus)
        })
        let prom = {
            self: options,
            action(callBack) {
                options
                    .off('action.prom')
                    .on('action.prom', callBack)
                return prom
            },
            close(callBack) {
                options
                    .off('close.prom')
                    .on('close.prom', callBack)
                return prom
            },
            then(callBack) {
                options
                    .off('open:after.prom')
                    .on('open:after.prom', callBack)
                return prom
            }
        }
        if (options.actions == null && options.buttons == null && options.html == null) {
            options.actions = { Ok(event) { event.detail.self.close() }}
        }
        options.off('.buttons')
        if (options.actions != null) {
            options.buttons = ''
            Object.keys(options.actions).forEach((action) => {
                let handler = options.actions[action]
                let btnAction = action
                if (typeof handler == 'function') {
                    options.buttons += `<button class="w2ui-btn w2ui-eaction" data-click='["action","${action}","event"]'>${action}</button>`
                }
                if (typeof handler == 'object') {
                    options.buttons += `<button class="w2ui-btn w2ui-eaction ${handler.class || ''}" data-click='["action","${action}","event"]'
                        style="${handler.style}" ${handler.attrs}>${handler.text || action}</button>`
                    btnAction = Array.isArray(options.actions) ? handler.text : action
                }
                if (typeof handler == 'string') {
                    options.buttons += `<button class="w2ui-btn w2ui-eaction" data-click='["action","${handler}","event"]'>${handler}</button>`
                    btnAction = handler
                }
                if (typeof btnAction == 'string') {
                    btnAction = btnAction[0].toLowerCase() + btnAction.substr(1).replace(/\s+/g, '')
                }
                prom[btnAction] = function (callBack) {
                    options.on('action.buttons', (event) => {
                        let target = event.detail.action[0].toLowerCase() + event.detail.action.substr(1).replace(/\s+/g, '')
                        if (target == btnAction) callBack(event)
                    })
                    return prom
                }
            })
        }
        // trim if any
        Array('html', 'body', 'buttons').forEach(param => {
             options[param] = String(options[param] ?? '').trim()
        })
        if (options.body !== '' || options.buttons !== '') {
            options.html = `
                <div class="w2ui-message-body">${options.body || ''}</div>
                <div class="w2ui-message-buttons">${options.buttons || ''}</div>
            `;
        }
        options.owner = this // since it is called with .call(...)
        let styles  = query(where.box)[0].computedStyleMap()
        let pWidth  = styles.get('width').value
        let pHeight = styles.get('height').value
        styles  = query(where.box).find(where.after)[0].computedStyleMap()
        let titleHeight = parseInt(styles.get('display').value != 'none' ? styles.get('height').value : 0)
        if (options.width > pWidth) options.width = pWidth - 10
        if (options.height > pHeight - titleHeight) options.height = pHeight - 10 - titleHeight
        options.originalWidth  = options.width
        options.originalHeight = options.height
        if (parseInt(options.width) < 0) options.width = pWidth + options.width
        if (parseInt(options.width) < 10) options.width = 10
        if (parseInt(options.height) < 0) options.height = pHeight + options.height - titleHeight
        if (parseInt(options.height) < 10) options.height = 10
        // negative value means margin
        if (options.originalHeight < 0) options.height = pHeight + options.originalHeight - titleHeight
        if (options.originalWidth < 0) options.width = pWidth + options.originalWidth * 2 // x 2 because there is left and right margin
        let head = query(where.box).find(where.after) // needed for z-index manipulations
        head.data('old_zIndex', head.css('z-index'))
        // remove message
        if (options.html === '' && options.body === '' && options.buttons === '') {
            removeLast()
        } else {
            options.msgIndex = query(where.box).find('.w2ui-message').length
            if (options.msgIndex === 0 && typeof this.lock == 'function') {
                if (where.param) this.lock(where.param); else this.lock() // should be this
            }
            // send back previous messages
            query(where.box).find('.w2ui-message').css('z-index', 1390)
            head.css('z-index', 1501)
            // add message
            query(where.box).find(where.after)
                .after(`
                    <div id="w2ui-message-${options.owner.name}-${options.msgIndex}" class="w2ui-message" data-mousedown="stop"
                        style="z-index: 1500; left: ${((pWidth - options.width) / 2)}px; top: ${titleHeight}px;
                            width: ${options.width}px; height: ${options.height}px; transform: translateY(-${options.height}px)"
                        ${options.hideOn.includes('click')
                            ? where.param
                                ? `data-click='["message", "${where.param}"]`
                                : 'data-click="message"'
                            : ''}>
                        <span name="hidden-first" tabindex="0" style="position: absolute; top: -100px"></span>
                        ${options.html}
                        <span name="hidden-last" tabindex="0" style="position: absolute; top: -100px"></span>
                    </div>`)
            options.box = query(where.box).find(`#w2ui-message-${options.owner.name}-${options.msgIndex}`)[0]
            w2utils.bindEvents(options.box, this)
            query(options.box)
                .addClass('animating')
            // remember options and prev focus
            options.box._msg_options = options
            options.box._msg_prevFocus = document.activeElement
            // timeout is needs so that callBacks are setup
            setTimeout(() => {
                // before event
                edata = options.trigger('open', { target: this.name, box: options.box, self: options })
                if (edata.isCancelled === true) {
                    head.css('z-index', head.data('old_zIndex'))
                    query(where.box).find(`#w2ui-message-${options.owner.name}-${options.msgIndex}`).remove()
                    return
                }
                // slide down
                query(options.box).css({
                    transition: '0.3s',
                    transform: 'translateY(0px)'
                })
            }, 0)
            // timeout is needed so that animation can finish
            openTimer = setTimeout(() => {
                // has to be on top of lock
                query(where.box)
                    .find(`#w2ui-message-${options.owner.name}-${options.msgIndex}`)
                    .removeClass('animating')
                    .css({ 'transition': '0s' })
                // event after
                edata.finish()
            }, 300)
        }
        // action handler
        options.action = (action, event) => {
            let click = options.actions[action]
            if (click instanceof Object && click.onClick) click = click.onClick
            // event before
            let edata = options.trigger('action', { target: this.name, action, self: options,
                originalEvent: event, value: options.input ? options.input.value : null })
            if (edata.isCancelled === true) return
            // default actions
            if (typeof click === 'function') click(edata)
            // event after
            edata.finish()
        }
        options.close = () => {
            edata = options.trigger('close', { target: 'self', box: options.box, self: options })
            if (edata.isCancelled === true) return
            clearTimeout(openTimer)
            if (query(options.box).hasClass('animating')) {
                clearTimeout(closeTimer)
                closeComplete(options);
                return
            }
            // default behavior
            query(options.box)
                .addClass('w2ui-closing animating')
                .css({
                    'transition': '0.15s',
                    'transform': 'translateY(-' + options.height + 'px)'
                })
            if (options.msgIndex !== 0) {
                // previous message
                query(where.box).find(`#w2ui-message-${options.owner.name}-${options.msgIndex-1}`).css('z-index', 1499)
            }
            closeTimer = setTimeout(() => { closeComplete(options) }, 150)
        }
        options.setFocus = (focus) => {
            // in message or popup
            let cnt = query(where.box).find('.w2ui-message').length - 1
            let box = query(where.box).find(`#w2ui-message-${options.owner.name}-${cnt}`)
            let sel = 'input, button, select, textarea, [contentEditable], .w2ui-input'
            if (focus != null) {
                let el = isNaN(focus)
                    ? box.find(sel).filter(focus).get(0)
                    : box.find(sel).get(focus)
                el?.focus()
            } else {
                box.find('[name=hidden-first]').get(0)?.focus()
            }
            // clear focus if there are other messages
            query(where.box)
                .find('.w2ui-message')
                .find(sel + ',[name=hidden-first],[name=hidden-last]')
                .off('.keep-focus')
            // keep focus/blur inside popup
            query(box)
                .find(sel + ',[name=hidden-first],[name=hidden-last]')
                .on('blur.keep-focus', function (event) {
                    setTimeout(() => {
                        let focus = document.activeElement
                        let inside = query(box).find(sel).filter(focus).length > 0
                        let name = query(focus).attr('name')
                        if (!inside && focus && focus !== document.body) {
                            query(box).find(sel).get(0)?.focus()
                        }
                        if (name == 'hidden-last') {
                            query(box).find(sel).get(0)?.focus()
                        }
                        if (name == 'hidden-first') {
                            query(box).find(sel).get(-1)?.focus()
                        }
                    }, 1)
                })
        }
        return prom
        function removeLast() {
            let msgs = query(where.box).find('.w2ui-message')
            if (msgs.length == 0) return // no messages already
            options = msgs.get(0)._msg_options || {}
            if (typeof options?.close == 'function') {
                options.close()
            }
        }
        function closeComplete(options) {
            let focus = options.box._msg_prevFocus
            if (query(where.box).find('.w2ui-message').length <= 1) {
                if (options.owner.unlock) {
                    if (where.param) {
                        options.owner.unlock(where.param, 150)
                     } else {
                        options.owner.unlock(150) // owner of themessage
                     }
                }
            } else {
                query(where.box).find(`#w2ui-message-${options.owner.name}-${options.msgIndex-1}`).css('z-index', 1500)
            }
            if (focus) {
                let msg = query(focus).closest('.w2ui-message')
                if (msg.length > 0) {
                    let opt = msg.get(0)._msg_options
                    opt.setFocus(focus)
                } else {
                    focus.focus()
                }
            } else {
                if (options.owner && typeof options.owner.focus == 'function') owner.focus()
            }
            head.css('z-index', head.data('old_zIndex'))
            query(options.box).remove()
            // event after
            if (options.trigger) {
                edata.finish()
            }
        }
    }
    confirm(where, options) {
        if (typeof options == 'string') {
            options = { text: options }
        }
        w2utils.normButtons(options, { yes: 'Yes', no: 'No' })
        return w2utils.message.call(this, where, options)
    }
    /**
     * Normalizes yes, no buttons for confirmation dialog
     *
     * @param {*} options
     * @returns  options
     */
    normButtons(options, btn) {
        options.actions = options.actions ?? {}
        let btns = Object.keys(btn)
        btns.forEach(name => {
            let action = options['btn_' + name]
            if (action) {
                btn[name] = {
                    text: w2utils.lang(action.text ?? ''),
                    class: action.class ?? '',
                    style: action.style ?? '',
                    attrs: action.attrs ?? ''
                }
                delete options['btn_' + name]
            }
            Array('text', 'class', 'style', 'attrs').forEach(suffix => {
                if (options[name + '_' + suffix]) {
                    if (typeof btn[name] == 'string') {
                        btn[name] = { text: btn[name] }
                    }
                    btn[name][suffix] = options[name + '_' + suffix]
                    delete options[name + '_' + suffix]
                }
            })
        })
        if (btns.includes('yes') && btns.includes('no')) {
            if (w2utils.settings.macButtonOrder) {
                w2utils.extend(options.actions, { no: btn.no, yes: btn.yes })
            } else {
                w2utils.extend(options.actions, { yes: btn.yes, no: btn.no })
            }
        }
        if (btns.includes('ok') && btns.includes('cancel')) {
            if (w2utils.settings.macButtonOrder) {
                w2utils.extend(options.actions, { cancel: btn.cancel, ok: btn.ok })
            } else {
                w2utils.extend(options.actions, { ok: btn.ok, cancel: btn.cancel })
            }
        }
        return options
    }
    getSize(el, type) {
        el = query(el) // for backward compatibility
        let ret = 0
        if (el.length > 0) {
            el = el[0]
            let styles = getComputedStyle(el)
            switch (type) {
                case 'width' :
                    ret = parseFloat(styles.width)
                    if (styles.width === 'auto') ret = 0;
                    break
                case 'height' :
                    ret = parseFloat(styles.height)
                    if (styles.height === 'auto') ret = 0;
                    break
            }
        }
        return ret
    }
    getStrWidth(str, styles) {
        query('body').append(`
            <div id="_tmp_width" style="position: absolute; top: -9000px; ${styles || ''}">
                ${this.encodeTags(str)}
            </div>`)
        let width = query('#_tmp_width')[0].clientWidth
        query('#_tmp_width').remove()
        return width
    }
    execTemplate(str, replace_obj) {
        if (typeof str !== 'string' || !replace_obj || typeof replace_obj !== 'object') {
            return str
        }
        return str.replace(/\${([^}]+)?}/g, function($1, $2) { return replace_obj[$2]||$2 })
    }
    lang(phrase, params) {
        if (!phrase || this.settings.phrases == null // if no phrases at all
                || typeof phrase !== 'string' || '<=>='.includes(phrase)) {
            return this.execTemplate(phrase, params)
        }
        let translation = this.settings.phrases[phrase]
        if (translation == null) {
            translation = phrase
            if (this.settings.warnNoPhrase) {
                if (!this.settings.missing) {
                    this.settings.missing = {}
                }
                this.settings.missing[phrase] = '---' // collect phrases for translation, warn once
                this.settings.phrases[phrase] = '---'
                console.log(`Missing translation for "%c${phrase}%c", see %c w2utils.settings.phrases %c with value "---"`,
                    'color: orange', '',
                    'color: #999', '')
            }
        } else if (translation === '---' && !this.settings.warnNoPhrase) {
            translation = phrase
        }
        if (translation === '---') {
            translation = `<span ${this.tooltip(phrase)}>---</span>`
        }
        return this.execTemplate(translation, params)
    }
    locale(locale, keepPhrases, noMerge) {
        return new Promise((resolve, reject) => {
            // if locale is an array we call this function recursively and merge the results
            if (Array.isArray(locale)) {
                this.settings.phrases = {}
                let proms = []
                let files = {}
                locale.forEach((file, ind) => {
                    if (file.length === 5) {
                        file = 'locale/'+ file.toLowerCase() +'.json'
                        locale[ind] = file
                    }
                    proms.push(this.locale(file, true, false))
                })
                Promise.allSettled(proms)
                    .then(res => {
                        // order of files is important to merge
                        res.forEach(r => { files[r.value.file] = r.value.data })
                        locale.forEach(file => {
                            this.settings = this.extend({}, this.settings, files[file])
                        })
                        resolve()
                    })
                return
            }
            if (!locale) locale = 'en-us'
            // if locale is an object, then merge it with w2utils.settings
            if (locale instanceof Object) {
                this.settings = this.extend({}, this.settings, w2locale, locale)
                return
            }
            if (locale.length === 5) {
                locale = 'locale/'+ locale.toLowerCase() +'.json'
            }
            // load from the file
            fetch(locale, { method: 'GET' })
                .then(res => res.json())
                .then(data => {
                    if (noMerge !== true) {
                        if (keepPhrases) {
                            // keep phrases, useful for recursive calls
                            this.settings = this.extend({}, this.settings, data)
                        } else {
                            // clear phrases from language before merging
                            this.settings = this.extend({}, this.settings, w2locale, { phrases: {} }, data)
                        }
                    }
                    resolve({ file: locale, data })
                })
                .catch((err) => {
                    console.log('ERROR: Cannot load locale '+ locale)
                    reject(err)
                })
        })
    }
    scrollBarSize() {
        if (this.tmp.scrollBarSize) return this.tmp.scrollBarSize
        let html = `
            <div id="_scrollbar_width" style="position: absolute; top: -300px; width: 100px; height: 100px; overflow-y: scroll;">
                <div style="height: 120px">1</div>
            </div>
        `
        query('body').append(html)
        this.tmp.scrollBarSize = 100 - query('#_scrollbar_width > div')[0].clientWidth
        query('#_scrollbar_width').remove()
        return this.tmp.scrollBarSize
    }
    checkName(name) {
        if (name == null) {
            console.log('ERROR: Property "name" is required but not supplied.')
            return false
        }
        if (w2ui[name] != null) {
            console.log(`ERROR: Object named "${name}" is already registered as w2ui.${name}.`)
            return false
        }
        if (!this.isAlphaNumeric(name)) {
            console.log('ERROR: Property "name" has to be alpha-numeric (a-z, 0-9, dash and underscore).')
            return false
        }
        return true
    }
    checkUniqueId(id, items, desc, obj) {
        if (!Array.isArray(items)) items = [items]
        let isUnique = true
        items.forEach(item => {
            if (item.id === id) {
                console.log(`ERROR: The item id="${id}" is not unique within the ${desc} "${obj}".`, items)
                isUnique = false
            }
        })
        return isUnique
    }
    /**
     * Takes an object and encodes it into params string to be passed as a url
     * { a: 1, b: 'str'}                => "a=1&b=str"
     * { a: 1, b: { c: 2 }}             => "a=1&b[c]=2"
     * { a: 1, b: {c: { k: 'dfdf' } } } => "a=1&b[c][k]=dfdf"
     */
    encodeParams(obj, prefix = '') {
        let str = ''
        Object.keys(obj).forEach(key => {
            if (str != '') str += '&'
            if (typeof obj[key] == 'object') {
                str += this.encodeParams(obj[key], prefix + key + (prefix ? ']' : '') + '[')
            } else {
                str += `${prefix}${key}${prefix ? ']' : ''}=${obj[key]}`
            }
        })
        return str
    }
    parseRoute(route) {
        let keys = []
        let path = route
            .replace(/\/\(/g, '(?:/')
            .replace(/\+/g, '__plus__')
            .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g, (_, slash, format, key, capture, optional) => {
                keys.push({ name: key, optional: !! optional })
                slash = slash || ''
                return '' + (optional ? '' : slash) + '(?:' + (optional ? slash : '') + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')' + (optional || '')
            })
            .replace(/([\/.])/g, '\\$1')
            .replace(/__plus__/g, '(.+)')
            .replace(/\*/g, '(.*)')
        return {
            path  : new RegExp('^' + path + '$', 'i'),
            keys  : keys
        }
    }
    cssPrefix(field, value, returnString) {
        let css    = {}
        let newCSS = {}
        let ret    = ''
        if (!(field instanceof Object)) {
            css[field] = value
        } else {
            css = field
            if (value === true) returnString = true
        }
        for (let c in css) {
            newCSS[c]            = css[c]
            newCSS['-webkit-'+c] = css[c]
            newCSS['-moz-'+c]    = css[c].replace('-webkit-', '-moz-')
            newCSS['-ms-'+c]     = css[c].replace('-webkit-', '-ms-')
            newCSS['-o-'+c]      = css[c].replace('-webkit-', '-o-')
        }
        if (returnString === true) {
            for (let c in newCSS) {
                ret += c + ': ' + newCSS[c] + '; '
            }
        } else {
            ret = newCSS
        }
        return ret
    }
    getCursorPosition(input) {
        if (input == null) return null
        let caretOffset = 0
        let doc         = input.ownerDocument || input.document
        let win         = doc.defaultView || doc.parentWindow
        let sel
        if (input.tagName && input.tagName.toUpperCase() === 'INPUT' && input.selectionStart) {
            // standards browser
            caretOffset = input.selectionStart
        } else {
            if (win.getSelection) {
                sel = win.getSelection()
                if (sel.rangeCount > 0) {
                    let range         = sel.getRangeAt(0)
                    let preCaretRange = range.cloneRange()
                    preCaretRange.selectNodeContents(input)
                    preCaretRange.setEnd(range.endContainer, range.endOffset)
                    caretOffset = preCaretRange.toString().length
                }
            } else if ( (sel = doc.selection) && sel.type !== 'Control') {
                let textRange         = sel.createRange()
                let preCaretTextRange = doc.body.createTextRange()
                preCaretTextRange.moveToElementText(input)
                preCaretTextRange.setEndPoint('EndToEnd', textRange)
                caretOffset = preCaretTextRange.text.length
            }
        }
        return caretOffset
    }
    setCursorPosition(input, pos, posEnd) {
        let range   = document.createRange()
        let el, sel = window.getSelection()
        if (input == null) return
        for (let i = 0; i < input.childNodes.length; i++) {
            let tmp = query(input.childNodes[i]).text()
            if (input.childNodes[i].tagName) {
                tmp = query(input.childNodes[i]).html()
                tmp = tmp.replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&nbsp;/g, ' ')
            }
            if (pos <= tmp.length) {
                el = input.childNodes[i]
                if (el.childNodes && el.childNodes.length > 0) el = el.childNodes[0]
                if (el.childNodes && el.childNodes.length > 0) el = el.childNodes[0]
                break
            } else {
                pos -= tmp.length
            }
        }
        if (el == null) return
        if (pos > el.length) pos = el.length
        range.setStart(el, pos)
        if (posEnd) {
            range.setEnd(el, posEnd)
        } else {
            range.collapse(true)
        }
        sel.removeAllRanges()
        sel.addRange(range)
    }
    parseColor(str) {
        if (typeof str !== 'string') return null; else str = str.trim().toUpperCase()
        if (str[0] === '#') str = str.substr(1)
        let color = {}
        if (str.length === 3) {
            color = {
                r: parseInt(str[0] + str[0], 16),
                g: parseInt(str[1] + str[1], 16),
                b: parseInt(str[2] + str[2], 16),
                a: 1
            }
        } else if (str.length === 6) {
            color = {
                r: parseInt(str.substr(0, 2), 16),
                g: parseInt(str.substr(2, 2), 16),
                b: parseInt(str.substr(4, 2), 16),
                a: 1
            }
        } else if (str.length === 8) {
            color = {
                r: parseInt(str.substr(0, 2), 16),
                g: parseInt(str.substr(2, 2), 16),
                b: parseInt(str.substr(4, 2), 16),
                a: Math.round(parseInt(str.substr(6, 2), 16) / 255 * 100) / 100 // alpha channel 0-1
            }
        } else if (str.length > 4 && str.substr(0, 4) === 'RGB(') {
            let tmp = str.replace('RGB', '').replace(/\(/g, '').replace(/\)/g, '').split(',')
            color   = {
                r: parseInt(tmp[0], 10),
                g: parseInt(tmp[1], 10),
                b: parseInt(tmp[2], 10),
                a: 1
            }
        } else if (str.length > 5 && str.substr(0, 5) === 'RGBA(') {
            let tmp = str.replace('RGBA', '').replace(/\(/g, '').replace(/\)/g, '').split(',')
            color   = {
                r: parseInt(tmp[0], 10),
                g: parseInt(tmp[1], 10),
                b: parseInt(tmp[2], 10),
                a: parseFloat(tmp[3])
            }
        } else {
            // word color
            return null
        }
        return color
    }
    // h=0..360, s=0..100, v=0..100
    hsv2rgb(h, s, v, a) {
        let r, g, b, i, f, p, q, t
        if (arguments.length === 1) {
            s = h.s; v = h.v; a = h.a; h = h.h
        }
        h = h / 360
        s = s / 100
        v = v / 100
        i = Math.floor(h * 6)
        f = h * 6 - i
        p = v * (1 - s)
        q = v * (1 - f * s)
        t = v * (1 - (1 - f) * s)
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break
            case 1: r = q, g = v, b = p; break
            case 2: r = p, g = v, b = t; break
            case 3: r = p, g = q, b = v; break
            case 4: r = t, g = p, b = v; break
            case 5: r = v, g = p, b = q; break
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
            a: (a != null ? a : 1)
        }
    }
    // r=0..255, g=0..255, b=0..255
    rgb2hsv(r, g, b, a) {
        if (arguments.length === 1) {
            g = r.g; b = r.b; a = r.a; r = r.r
        }
        let max = Math.max(r, g, b), min = Math.min(r, g, b),
            d = max - min,
            h,
            s = (max === 0 ? 0 : d / max),
            v = max / 255
        switch (max) {
            case min: h = 0; break
            case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break
            case g: h = (b - r) + d * 2; h /= 6 * d; break
            case b: h = (r - g) + d * 4; h /= 6 * d; break
        }
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            v: Math.round(v * 100),
            a: (a != null ? a : 1)
        }
    }
    tooltip(html, options) {
        let actions,
            showOn = 'mouseenter',
            hideOn = 'mouseleave',
            isOverlay = false
        if (typeof html == 'object') {
            options = html
        }
        options = options || {}
        if (typeof html == 'string') {
            options.html = html
        }
        if (options.showOn) {
            showOn = options.showOn
            delete options.showOn
        }
        if (options.hideOn) {
            hideOn = options.hideOn
            delete options.hideOn
        }
        if (options.overlay === true) {
            isOverlay = true
            delete options.overlay
        }
        // base64 is needed to avoid '"<> and other special chars conflicts
        actions = ` on${showOn}="jQuery(this).${isOverlay ? 'w2overlay' : 'w2tag'}(`
                + `JSON.parse(w2utils.base64decode('${this.base64encode(JSON.stringify(options))}')))" `
                + `on${hideOn}="jQuery(this).${isOverlay ? 'w2overlay' : 'w2tag'}(`
                + `${isOverlay && options.name != null
                    ? `JSON.parse(w2utils.base64decode('${this.base64encode(JSON.stringify({ name: options.name }))}'))`
                    : ''}`
                + ')"'
        return actions
    }
    // determins if it is plain Object, not DOM element, nor a function, event, etc.
    isPlainObject(value) {
        if (value == null) { // null or undefined
            return false
        }
        if (Object.prototype.toString.call(value) !== '[object Object]') {
            return false
        }
        if (value.constructor === undefined) {
            return true
        }
        let proto = Object.getPrototypeOf(value)
        return proto === null || proto === Object.prototype
    }
    // deep copy of an object or an array
    clone(obj) {
        let ret
        if (Array.isArray(obj)) {
            ret = Array.from(obj)
            ret.forEach((value, ind) => {
                ret[ind] = this.clone(value)
            })
        } else if (this.isPlainObject(obj)) {
            ret = {}
            Object.assign(ret, obj)
            Object.keys(ret).forEach(key => {
                ret[key] = this.clone(ret[key])
            })
        } else {
            // primitive variable or function, event, dom element, etc,
            // all these are not cloned
            ret = obj
        }
        return ret
    }
    // deep extend an object or an array, if an array, it does concat, cloning objects in the process
    // target, source1, source2, ...
    extend(target, source) {
        if (Array.isArray(target)) {
            if (Array.isArray(source)) {
                source.forEach(s => { target.push(this.clone(s)) })
            } else {
                throw new Error('Arrays can be extended with arrays only')
            }
        } else if (target && typeof target == 'object' && source != null) {
            if (typeof source != 'object') {
                throw new Error("Object can be extended with other objects only.")
            }
            Object.keys(source).forEach(key => {
                if (target[key] != null && typeof target[key] == 'object'
                        && source[key] != null && typeof source[key] == 'object') {
                    this.extend(target[key], this.clone(source[key]))
                } else {
                    target[key] = this.clone(source[key])
                }
            })
        } else if (source != null) {
            throw new Error("Object is not extendable, only {} or [] can be extended.")
        }
        // other arguments
        if (arguments.length > 2) {
            for (let i = 2; i < arguments.length; i++) {
                this.extend(target, arguments[i])
            }
        }
        return target
    }
    /*
     * @author     Lauri Rooden (https://github.com/litejs/natural-compare-lite)
     * @license    MIT License
     */
    naturalCompare(a, b) {
        let i, codeA
            , codeB = 1
            , posA = 0
            , posB = 0
            , alphabet = String.alphabet
        function getCode(str, pos, code) {
            if (code) {
                for (i = pos; code = getCode(str, i), code < 76 && code > 65;) ++i
                return +str.slice(pos - 1, i)
            }
            code = alphabet && alphabet.indexOf(str.charAt(pos))
            return code > -1 ? code + 76 : ((code = str.charCodeAt(pos) || 0), code < 45 || code > 127) ? code
                : code < 46 ? 65 // -
                : code < 48 ? code - 1
                : code < 58 ? code + 18 // 0-9
                : code < 65 ? code - 11
                : code < 91 ? code + 11 // A-Z
                : code < 97 ? code - 37
                : code < 123 ? code + 5 // a-z
                : code - 63
        }

        if ((a+='') != (b+='')) for (;codeB;) {
            codeA = getCode(a, posA++)
            codeB = getCode(b, posB++)
            if (codeA < 76 && codeB < 76 && codeA > 66 && codeB > 66) {
                codeA = getCode(a, posA, posA)
                codeB = getCode(b, posB, posA = i)
                posB  = i
            }
            if (codeA != codeB) return (codeA < codeB) ? -1 : 1
        }
        return 0
    }
    normMenu(menu, el) {
        if (Array.isArray(menu)) {
            menu.forEach((it, m) => {
                if (typeof it === 'string' || typeof it === 'number') {
                    menu[m] = { id: it, text: it }
                } else if (it != null) {
                    if (it.caption != null && it.text == null) it.text = it.caption
                    if (it.text != null && it.id == null) it.id = it.text
                    if (it.text == null && it.id != null) it.text = it.id
                } else {
                    menu[m] = { id: null, text: 'null' }
                }
            })
            return menu
        } else if (typeof menu === 'function') {
            let newMenu = menu.call(this, menu, el)
            return w2utils.normMenu.call(this, newMenu)
        } else if (typeof menu === 'object') {
            return Object.keys(menu).map(key => { return { id: key, text: menu[key] } })
        }
    }
    bindEvents(selector, subject) {
        // format is
        // <div ... data-<event>='["<method>","param1","param2",...]'> -- should be valid JSON (no undefined)
        // <div ... data-<event>="<method>|param1|param2">
        // -- can have "event", "this", "stop", "stopPrevent", "alert" - as predefined objects
        if (selector.length == 0) return
        // for backward compatibility
        if (selector && !(selector instanceof HTMLElement) && selector[0] instanceof HTMLElement) {
            selector = Array.isArray(selector) ? selector : selector.get()
        }
        query(selector).each((el) => {
            let actions = query(el).data()
            Object.keys(actions).forEach(name => {
                let events = ['click', 'dblclick', 'mouseenter', 'mouseleave', 'mouseover', 'mouseout', 'mousedown', 'mousemove', 'mouseup',
                    'contextmenu', 'focus', 'focusin', 'focusout', 'blur', 'input', 'change', 'keydown', 'keyup', 'keypress']
                if (events.indexOf(String(name).toLowerCase()) == -1) {
                    return
                }
                let params = actions[name]
                if (typeof params == 'string') {
                    params = params.split('|').map(key => {
                        if (key === 'true') key = true
                        if (key === 'false') key = false
                        if (key === 'undefined') key = undefined
                        if (key === 'null') key = null
                        if (parseFloat(key) == key) key = parseFloat(key)
                        if (["'", '"', '`'].includes(key[0]) && ["'", '"', '`'].includes(key[key.length-1])) {
                            key = key.substring(1, key.length-1);
                        }
                        return key
                    })
                }
                let method = params[0]
                params = params.slice(1) // should be new array
                query(el)
                    .off(name + '.w2utils-bind')
                    .on(name + '.w2utils-bind', function(event) {
                        switch (method) {
                            case 'alert':
                                alert(params[0]) // for testing purposes
                                break
                            case 'stop':
                                event.stopPropagation()
                                break
                            case 'prevent':
                                event.preventDefault()
                                break
                            case 'stopPrevent':
                                event.stopPropagation()
                                event.preventDefault()
                                return false
                                break
                            default:
                                if (subject[method] == null) {
                                    throw new Error(`Cannot dispatch event as the method "${method}" does not exist.`)
                                }
                                subject[method].apply(subject, params.map((key, ind) => {
                                    switch (String(key).toLowerCase()) {
                                        case 'event':
                                            return event
                                        case 'this':
                                            return this
                                        default:
                                            return key
                                    }
                                }))
                        }
                    })
            })
        })
    }
}
var w2utils = new Utils() // needs to be functional/module scope variable
/**
 * Part of w2ui 2.0 library
 *  - Dependencies: mQuery, w2utils, w2base
 *
 * == 2.0 changes
 *  - CSP - fixed inline events
 *  - removed jQuery dependency
 *  - popup.open - returns promise like object
 *  - popup.confirm - refactored
 *  - popup.message - refactored
 *  - removed popup.options.mutliple
 *  - refactores w2alert, w2confirm, w2prompt
 *  - add w2popup.open().on('')
 *  - removed w2popup.restoreTemplate
 *  - deprecated onMsgOpen and onMsgClose
 *  - deprecated options.bgColor
 *  - rename focus -> setFocus
 */

class Dialog extends w2base {
    constructor() {
        super()
        this.defaults   = {
            title: '',
            text: '',           // just a text (will be centered)
            body: '',
            buttons: '',
            width: 450,
            height: 250,
            focus: null,        // brings focus to the element, can be a number or selector
            actions: null,      // actions object
            style: '',          // style of the message div
            speed: 0.3,
            modal: false,
            maximized: false,   // this is a flag to show the state - to open the popup maximized use openMaximized instead
            keyboard: true,     // will close popup on esc if not modal
            showClose: true,
            showMax: false,
            transition: null,
            openMaximized: false
        }
        this.name       = 'popup'
        this.status     = 'closed' // string that describes current status
        this.onOpen     = null
        this.onClose    = null
        this.onMax      = null
        this.onMin      = null
        this.onToggle   = null
        this.onKeydown  = null
        this.onAction   = null
        this.onMove     = null
    }
    /**
     * Sample calls
     * - w2popup.open('ddd').ok(() => { w2popup.close() })
     * - w2popup.open('ddd', { height: 120 }).ok(() => { w2popup.close() })
     * - w2popup.open({ body: 'text', title: 'caption', actions: ["Close"] }).close(() => { w2popup.close() })
     * - w2popup.open({ body: 'text', title: 'caption', actions: { Close() { w2popup.close() }} })
     */
    open(options) {
        let self = this
        if (w2popup.status == 'closing') {
            // if called when previous is closing
            setTimeout(() => { self.open.call(self, options) }, 100)
            return
        }
        // get old options and merge them
        let old_options = this.options
        if (['string', 'number'].includes(typeof options)) {
            options = w2utils.extend({
                title: 'Notification',
                body: `<div class="w2ui-centered">${options}</div>`,
                actions: { Ok() { w2popup.close() }},
                cancelAction: 'ok'
            }, arguments[1] ?? {})
        }
        if (options.text != null) options.body = `<div class="w2ui-centered w2ui-msg-text">${options.text}</div>`
        options = Object.assign({}, this.defaults, old_options, { title: '', body : '' }, options, { maximized: false })
        this.options = options
        // if new - reset event handlers
        if (query('#w2ui-popup').length === 0) {
            w2popup.off('*')
            Object.keys(w2popup).forEach(key => {
                if (key.startsWith('on') && key != 'on') w2popup[key] = null
            })
        }
        // reassign events
        Object.keys(options).forEach(key => {
            if (key.startsWith('on') && key != 'on' && options[key]) {
                w2popup[key] = options[key]
            }
        })
        options.width  = parseInt(options.width)
        options.height = parseInt(options.height)
        let maxW, maxH, edata, msg, tmp
        if (window.innerHeight == undefined) {
            maxW = parseInt(document.documentElement.offsetWidth)
            maxH = parseInt(document.documentElement.offsetHeight)
        } else {
            maxW = parseInt(window.innerWidth)
            maxH = parseInt(window.innerHeight)
        }
        if (maxW - 10 < options.width) options.width = maxW - 10
        if (maxH - 10 < options.height) options.height = maxH - 10
        let top  = (maxH - options.height) / 2
        let left = (maxW - options.width) / 2
        let prom = {
            self: this,
            action(callBack) {
                self.on('action.prom', callBack)
                return prom
            },
            close(callBack) {
                self.on('close.prom', callBack)
                return prom
            },
            then(callBack) {
                self.on('open:after.prom', callBack)
                return prom
            }
        }
        // convert action arrays into buttons
        if (options.actions != null && !options.buttons) {
            options.buttons = ''
            Object.keys(options.actions).forEach((action) => {
                let handler = options.actions[action]
                let btnAction = action
                if (typeof handler == 'function') {
                    options.buttons += `<button class="w2ui-btn w2ui-eaction" data-click='["action","${action}","event"]'>${action}</button>`
                }
                if (typeof handler == 'object') {
                    options.buttons += `<button class="w2ui-btn w2ui-eaction ${handler.class || ''}" data-click='["action","${action}","event"]'
                        style="${handler.style}" ${handler.attrs}>${handler.text || action}</button>`
                    btnAction = Array.isArray(options.actions) ? handler.text : action
                }
                if (typeof handler == 'string') {
                    options.buttons += `<button class="w2ui-btn w2ui-eaction" data-click='["action","${handler}","event"]'>${handler}</button>`
                    btnAction = handler
                }
                if (typeof btnAction == 'string') {
                    btnAction = btnAction[0].toLowerCase() + btnAction.substr(1).replace(/\s+/g, '')
                }
                prom[btnAction] = function (callBack) {
                    self.on('action.buttons', (event) => {
                            let target = event.detail.action[0].toLowerCase() + event.detail.action.substr(1).replace(/\s+/g, '')
                            if (target == btnAction) callBack(event)
                        })
                    return prom
                }
            })
        }
        // check if message is already displayed
        if (query('#w2ui-popup').length === 0) {
            // trigger event
            edata = this.trigger('open', { target: 'popup', present: false })
            if (edata.isCancelled === true) return
            w2popup.status = 'opening'
            // output message
            w2utils.lock(document.body, {
                opacity: 0.3,
                onClick: options.modal ? null : () => { w2popup.close() }
            })
            let btn = ''
            if (options.showClose) {
                btn += `<div class="w2ui-popup-button w2ui-popup-close">
                            <span class="w2ui-icon w2ui-icon-cross w2ui-eaction" data-mousedown="stop" data-click="close"></span>
                        </div>`
            }
            if (options.showMax) {
                btn += `<div class="w2ui-popup-button w2ui-popup-max">
                            <span class="w2ui-icon w2ui-icon-box w2ui-eaction" data-mousedown="stop" data-click="toggle"></span>
                        </div>`
            }
            // first insert just body
            msg = `<div id="w2ui-popup" class="w2ui-popup w2ui-anim-open animating" style="left: ${left}px; top: ${top}px;
                        width: ${parseInt(options.width)}px; height: ${parseInt(options.height)}px;
                        transition: ${options.speed}s"></div>`
            query('body').append(msg)
            // then content
            msg = `
                <span name="hidden-first" tabindex="0" style="position: absolute; top: -100px"></span>
                <div class="w2ui-popup-title" style="${!options.title ? 'display: none' : ''}">${btn}</div>
                <div class="w2ui-box" style="${!options.title ? 'top: 0px !important;' : ''}
                        ${!options.buttons ? 'bottom: 0px !important;' : ''}">
                    <div class="w2ui-popup-body ${!options.title || ' w2ui-popup-no-title'}
                        ${!options.buttons || ' w2ui-popup-no-buttons'}" style="${options.style}">
                    </div>
                </div>
                <div class="w2ui-popup-buttons" style="${!options.buttons ? 'display: none' : ''}"></div>
                <span name="hidden-last" tabindex="0" style="position: absolute; top: -100px"></span>
            `
            query('#w2ui-popup').html(msg)
            if (options.title) query('#w2ui-popup .w2ui-popup-title').append(w2utils.lang(options.title))
            if (options.buttons) query('#w2ui-popup .w2ui-popup-buttons').append(options.buttons)
            if (options.body) query('#w2ui-popup .w2ui-popup-body').append(options.body)
            // allow element to render
            setTimeout(() => {
                query('#w2ui-popup')
                    .css('transition', options.speed + 's')
                    .removeClass('w2ui-anim-open')
                w2utils.bindEvents('#w2ui-popup .w2ui-eaction', w2popup)
                query('#w2ui-popup').find('.w2ui-popup-body').show()
                self.setFocus(options.focus)
                // event after
                edata.finish()
            }, 1)
            // clean transform
            clearTimeout(this._timer)
            this._timer = setTimeout(() => {
                query('#w2ui-popup').removeClass('animating')
                w2popup.status = 'open'
            }, options.speed * 1000)
        } else {
            // trigger event
            edata = this.trigger('open', { target: 'popup', present: true })
            if (edata.isCancelled === true) return
            // check if size changed
            w2popup.status = 'opening'
            if (old_options != null) {
                if (!old_options.maximized && (old_options.width != options.width || old_options.height != options.height)) {
                    w2popup.resize(options.width, options.height)
                }
                options.prevSize  = options.width + 'px:' + options.height + 'px'
                options.maximized = old_options.maximized
            }
            // show new items
            let cloned = query('#w2ui-popup .w2ui-box').get(0).cloneNode(true)
            query(cloned).removeClass('w2ui-box').addClass('w2ui-box-temp').find('.w2ui-popup-body').empty().append(options.body)
            query('#w2ui-popup .w2ui-box').after(cloned)
            if (options.buttons) {
                query('#w2ui-popup .w2ui-popup-buttons').show().html('').append(options.buttons)
                query('#w2ui-popup .w2ui-popup-body').removeClass('w2ui-popup-no-buttons')
                query('#w2ui-popup .w2ui-box, #w2ui-popup .w2ui-box-temp').css('bottom', '')
            } else {
                query('#w2ui-popup .w2ui-popup-buttons').hide().html('')
                query('#w2ui-popup .w2ui-popup-body').addClass('w2ui-popup-no-buttons')
                query('#w2ui-popup .w2ui-box, #w2ui-popup .w2ui-box-temp').css('bottom', '0px')
            }
            if (options.title) {
                query('#w2ui-popup .w2ui-popup-title')
                    .show()
                    .html((options.showClose
                        ? `<div class="w2ui-popup-button w2ui-popup-close">
                                <span class="w2ui-icon w2ui-icon-cross w2ui-eaction" data-mousedown="stop" data-click="close"></span>
                            </div>`
                        : '') +
                        (options.showMax
                        ? `<div class="w2ui-popup-button w2ui-popup-max">
                                <span class="w2ui-icon w2ui-icon-box w2ui-eaction" data-mousedown="stop" data-click="toggle"></span>
                            </div>`
                        : ''))
                    .append(options.title)
                query('#w2ui-popup .w2ui-popup-body').removeClass('w2ui-popup-no-title')
                query('#w2ui-popup .w2ui-box, #w2ui-popup .w2ui-box-temp').css('top', '')
            } else {
                query('#w2ui-popup .w2ui-popup-title').hide().html('')
                query('#w2ui-popup .w2ui-popup-body').addClass('w2ui-popup-no-title')
                query('#w2ui-popup .w2ui-box, #w2ui-popup .w2ui-box-temp').css('top', '0px')
            }
            // transition
            let div_old = query('#w2ui-popup .w2ui-box')[0]
            let div_new = query('#w2ui-popup .w2ui-box-temp')[0]
            w2utils.transition(div_old, div_new, options.transition, () => {
                // clean up
                query(div_old).remove()
                query(div_new).removeClass('w2ui-box-temp').addClass('w2ui-box')
                let $body = query(div_new).find('.w2ui-popup-body')
                if ($body.length == 1) {
                    $body[0].style.cssText = options.style
                    $body.show()
                }
                // remove max state
                query('#w2ui-popup').data('prev-size', null)
                // focus on first button
                self.setFocus(options.focus)
            })
            // call event onOpen
            w2popup.status = 'open'
            edata.finish()
            w2utils.bindEvents('#w2ui-popup .w2ui-eaction', w2popup)
            query('#w2ui-popup').find('.w2ui-popup-body').show()
        }
        if (options.openMaximized) {
            this.max()
        }
        // save new options
        options._last_focus = document.activeElement
        // keyboard events
        if (options.keyboard) query(document.body).on('keydown', this.keydown)
        // initialize move
        tmp = {
            resizing : false,
            mvMove   : mvMove,
            mvStop   : mvStop
        }
        query('#w2ui-popup .w2ui-popup-title').on('mousedown', function(event) {
            if (!w2popup.options.maximized) mvStart(event)
        })
        return prom
        // handlers
        function mvStart(evt) {
            if (!evt) evt = window.event
            w2popup.status = 'moving'
            let rect = query('#w2ui-popup').get(0).getBoundingClientRect()
            Object.assign(tmp, {
                resizing: true,
                isLocked: query('#w2ui-popup > .w2ui-lock').length == 1 ? true : false,
                x       : evt.screenX,
                y       : evt.screenY,
                pos_x   : rect.x,
                pos_y   : rect.y,
            })
            if (!tmp.isLocked) w2popup.lock({ opacity: 0 })
            query(document.body)
                .on('mousemove.w2ui-popup', tmp.mvMove)
                .on('mouseup.w2ui-popup', tmp.mvStop)
            if (evt.stopPropagation) evt.stopPropagation(); else evt.cancelBubble = true
            if (evt.preventDefault) evt.preventDefault(); else return false
        }
        function mvMove(evt) {
            if (tmp.resizing != true) return
            if (!evt) evt = window.event
            tmp.div_x = evt.screenX - tmp.x
            tmp.div_y = evt.screenY - tmp.y
            // trigger event
            let edata = w2popup.trigger('move', { target: 'popup', div_x: tmp.div_x, div_y: tmp.div_y, originalEvent: evt })
            if (edata.isCancelled === true) return
            // default behavior
            query('#w2ui-popup').css({
                'transition': 'none',
                'transform' : 'translate3d('+ tmp.div_x +'px, '+ tmp.div_y +'px, 0px)'
            })
            // event after
            edata.finish()
        }
        function mvStop(evt) {
            if (tmp.resizing != true) return
            if (!evt) evt = window.event
            w2popup.status = 'open'
            tmp.div_x      = (evt.screenX - tmp.x)
            tmp.div_y      = (evt.screenY - tmp.y)
            query('#w2ui-popup')
                .css({
                    'left': (tmp.pos_x + tmp.div_x) + 'px',
                    'top' : (tmp.pos_y + tmp.div_y) + 'px'
                })
                .css({
                    'transition': 'none',
                    'transform' : 'translate3d(0px, 0px, 0px)'
                })
            tmp.resizing = false
            query(document.body).off('.w2ui-popup')
            if (!tmp.isLocked) w2popup.unlock()
        }
    }
    load(options) {
        return new Promise((resolve, reject) => {
            if (typeof options == 'string') {
                options = { url: options }
            }
            if (options.url == null) {
                console.log('ERROR: The url is not defined.')
                reject('The url is not defined')
                return
            }
            w2popup.status = 'loading'
            let [url, selector] = String(options.url).split('#')
            if (url) {
                fetch(url).then(res => { return res.text() }).then(html => {
                    this.template(html, selector, options).then(() => { resolve() })
                })
            }
        })
    }
    template(data, id, options = {}) {
        let html
        try {
            html = query(data)
        } catch(e) {
            html = query.html(data)
        }
        if (id) html = html.filter('#' + id)
        Object.assign(options, {
            width: parseInt(query(html).css('width')),
            height: parseInt(query(html).css('height')),
            title: query(html).find('[rel=title]').html(),
            body: query(html).find('[rel=body]').html(),
            buttons: query(html).find('[rel=buttons]').html(),
            style: query(html).find('[rel=body]').get(0).style.cssText,
        })
        return w2popup.open(options)
    }
    action(action, event) {
        let click = this.options.actions[action]
        if (click instanceof Object && click.onClick) click = click.onClick
        // event before
        let edata = this.trigger('action', { action, target: 'popup', self: this,
            originalEvent: event, value: this.input ? this.input.value : null })
        if (edata.isCancelled === true) return
        // default actions
        if (typeof click === 'function') click.call(this, event)
        // event after
        edata.finish()
    }
    keydown(event) {
        if (this.options && !this.options.keyboard) return
        // trigger event
        let edata = w2popup.trigger('keydown', { target: 'popup', originalEvent: event })
        if (edata.isCancelled === true) return
        // default behavior
        switch (event.keyCode) {
            case 27:
                event.preventDefault()
                if (query('#w2ui-popup .w2ui-message').length == 0) {
                    if (w2popup.options.cancelAction) {
                        w2popup.action(w2popup.options.cancelAction)
                    } else {
                        w2popup.close()
                    }
                }
                break
        }
        // event after
        edata.finish()
    }
    close() {
        let self = this
        if (query('#w2ui-popup').length === 0 || this.status == 'closed') return
        if (this.status == 'opening') {
            setTimeout(() => { w2popup.close() }, 100)
            return
        }
        // trigger event
        let edata = this.trigger('close', { target: 'popup' })
        if (edata.isCancelled === true) return
        // default behavior
        w2popup.status = 'closing'
        query('#w2ui-popup')
            .css('transition', this.options.speed + 's')
            .addClass('w2ui-anim-close animating')
        w2utils.unlock(document.body, 300)
        setTimeout(() => {
            // return template
            query('#w2ui-popup').remove()
            // restore active
            if (this.options._last_focus && this.options._last_focus.length > 0) this.options._last_focus.focus()
            w2popup.status = 'closed'
            w2popup.options = {}
            // event after
            edata.finish()
        }, this.options.speed * 1000)
        // remove keyboard events
        if (this.options.keyboard) {
            query(document.body).off('keydown', this.keydown)
        }
    }
    toggle() {
        let self = this
        // trigger event
        let edata = this.trigger('togle', { target: 'popup' })
        if (edata.isCancelled === true) return
        // default action
        if (this.options.maximized === true) w2popup.min(); else w2popup.max()
        // event after
        setTimeout(() => {
            edata.finish()
        }, (this.options.speed * 1000) + 50)
    }
    max() {
        let self = this
        if (this.options.maximized === true) return
        // trigger event
        let edata = this.trigger('max', { target: 'popup' })
        if (edata.isCancelled === true) return
        // default behavior
        w2popup.status = 'resizing'
        let rect = query('#w2ui-popup').get(0).getBoundingClientRect()
        this.options.prevSize = rect.width + ':' + rect.height
        // do resize
        w2popup.resize(10000, 10000, () => {
            w2popup.status    = 'open'
            this.options.maximized = true
            edata.finish()
        })
    }
    min() {
        let self = this
        if (this.options.maximized !== true) return
        let size = this.options.prevSize.split(':')
        // trigger event
        let edata = this.trigger('min', { target: 'popup' })
        if (edata.isCancelled === true) return
        // default behavior
        w2popup.status = 'resizing'
        // do resize
        w2popup.resize(parseInt(size[0]), parseInt(size[1]), () => {
            w2popup.status    = 'open'
            this.options.maximized = false
            this.options.prevSize  = null
            edata.finish()
        })
    }
    clear() {
        query('#w2ui-popup .w2ui-popup-title').html('')
        query('#w2ui-popup .w2ui-popup-body').html('')
        query('#w2ui-popup .w2ui-popup-buttons').html('')
    }
    reset() {
        w2popup.open(w2popup.defaults)
    }
    message(options) {
        return w2utils.message.call(this, {
            box   : query('#w2ui-popup'),
            after : '.w2ui-popup-title'
        }, options)
    }
    confirm(options) {
        return w2utils.confirm.call(this, {
            box   : query('#w2ui-popup'),
            after : '.w2ui-popup-title'
        }, options)
    }
    setFocus(focus) {
        let box = query('#w2ui-popup')
        let sel = 'input, button, select, textarea, [contentEditable], .w2ui-input'
        if (focus != null) {
            let el = isNaN(focus)
                ? box.find(sel).filter(focus).get(0)
                : box.find(sel).get(focus)
            el?.focus()
        } else {
            box.find('[name=hidden-first]').get(0).focus()
        }
        // keep focus/blur inside popup
        query(box).find(sel + ',[name=hidden-first],[name=hidden-last]')
            .off('.keep-focus')
            .on('blur.keep-focus', function (event) {
                setTimeout(() => {
                    let focus = document.activeElement
                    let inside = query(box).find(sel).filter(focus).length > 0
                    let name = query(focus).attr('name')
                    if (!inside && focus && focus !== document.body) {
                        query(box).find(sel).get(0)?.focus()
                    }
                    if (name == 'hidden-last') {
                        query(box).find(sel).get(0)?.focus()
                    }
                    if (name == 'hidden-first') {
                        query(box).find(sel).get(-1)?.focus()
                    }
                }, 1)
            })
    }
    lock(msg, showSpinner) {
        let args = Array.from(arguments)
        args.unshift(query('#w2ui-popup'))
        w2utils.lock(...args)
    }
    unlock(speed) {
        w2utils.unlock(query('#w2ui-popup'), speed)
    }
    resize(width, height, callBack) {
        let self = this
        if (this.options.speed == null) this.options.speed = 0
        width  = parseInt(width)
        height = parseInt(height)
        // calculate new position
        let maxW, maxH
        if (window.innerHeight == undefined) {
            maxW = parseInt(document.documentElement.offsetWidth)
            maxH = parseInt(document.documentElement.offsetHeight)
        } else {
            maxW = parseInt(window.innerWidth)
            maxH = parseInt(window.innerHeight)
        }
        if (maxW - 10 < width) width = maxW - 10
        if (maxH - 10 < height) height = maxH - 10
        let top  = (maxH - height) / 2
        let left = (maxW - width) / 2
        // resize there
        let speed = this.options.speed
        query('#w2ui-popup').css({
            'transition': `${speed}s width, ${speed}s height, ${speed}s left, ${speed}s top`,
            'top'   : top + 'px',
            'left'  : left + 'px',
            'width' : width + 'px',
            'height': height + 'px'
        })
        let tmp_int = setInterval(() => { self.resizeMessages() }, 10) // then messages resize nicely
        setTimeout(() => {
            clearInterval(tmp_int)
            this.options.width  = width
            this.options.height = height
            self.resizeMessages()
            if (typeof callBack == 'function') callBack()
        }, (this.options.speed * 1000) + 50) // give extra 50 ms
    }
    // internal function
    resizeMessages() {
        // see if there are messages and resize them
        query('#w2ui-popup .w2ui-message').each(msg => {
            let mopt = query(msg).data('options')
            let popup = query('#w2ui-popup')
            if (parseInt(mopt.width) < 10) mopt.width = 10
            if (parseInt(mopt.height) < 10) mopt.height = 10
            let rect = popup[0].getBoundingClientRect()
            let titleHeight = parseInt(popup.find('.w2ui-popup-title')[0].clientHeight)
            let pWidth      = parseInt(rect.width)
            let pHeight     = parseInt(rect.height)
            // re-calc width
            mopt.width = mopt.originalWidth
            if (mopt.width > pWidth - 10) {
                mopt.width = pWidth - 10
            }
            // re-calc height
            mopt.height = mopt.originalHeight
            if (mopt.height > pHeight - titleHeight - 5) {
                mopt.height = pHeight - titleHeight - 5
            }
            if (mopt.originalHeight < 0) mopt.height = pHeight + mopt.originalHeight - titleHeight
            if (mopt.originalWidth < 0) mopt.width = pWidth + mopt.originalWidth * 2 // x 2 because there is left and right margin
            query(msg).css({
                left    : ((pWidth - mopt.width) / 2) + 'px',
                width   : mopt.width + 'px',
                height  : mopt.height + 'px'
            })
        })
    }
}
function w2alert(msg, title, callBack) {
    let prom
    let options = {
        title: w2utils.lang(title ?? 'Notification'),
        body: `<div class="w2ui-centered w2ui-msg-text">${msg}</div>`,
        showClose: false,
        actions: ['Ok'],
        cancelAction: 'ok'
    }
    if (query('#w2ui-popup').length > 0 && w2popup.status != 'closing') {
        prom = w2popup.message(options)
    } else {
        prom = w2popup.open(options)
    }
    prom.ok((event) => {
        if (typeof event.detail.self?.close == 'function') {
            event.detail.self.close();
        }
        if (typeof callBack == 'function') callBack()
    })
    return prom
}
function w2confirm(msg, title, callBack) {
    let prom
    let options = msg
    if (['string', 'number'].includes(typeof options)) {
        options = { msg: options }
    }
    if (options.msg) {
        options.body = `<div class="w2ui-centered w2ui-msg-text">${options.msg}</div>`,
        delete options.msg
    }
    w2utils.extend(options, {
        title: w2utils.lang(title ?? 'Confirmation'),
        showClose: false,
        modal: true,
        cancelAction: 'no'
    })
    w2utils.normButtons(options, { yes: 'Yes', no: 'No' })
    if (query('#w2ui-popup').length > 0 && w2popup.status != 'closing') {
        prom = w2popup.message(options)
    } else {
        prom = w2popup.open(options)
    }
    prom.self
        .off('.confirm')
        .on('action:after.confirm', (event) => {
            if (typeof event.detail.self?.close == 'function') {
                event.detail.self.close();
            }
            if (typeof callBack == 'function') callBack(event.detail.action)
        })
    return prom
}
function w2prompt(label, title, callBack) {
    let prom
    let options = label
    if (['string', 'number'].includes(typeof options)) {
        options = { label: options }
    }
    if (options.label) {
        options.focus = 0
        options.body = (options.textarea
            ? `<div class="w2ui-prompt textarea">
                 <div>${options.label}</div>
                 <textarea id="w2prompt" class="w2ui-input" ${options.attrs ?? ''}
                    data-keydown="keydown|event" data-keyup="change|event">${options.value??''}</textarea>
               </div>`
            : `<div class="w2ui-prompt w2ui-centered">
                 <label>${options.label}</label>
                 <input id="w2prompt" class="w2ui-input" ${options.attrs ?? ''}
                    data-keydown="keydown|event" data-keyup="change|event" value="${options.value??''}">
               </div>`
        )
    }
    w2utils.extend(options, {
        title: w2utils.lang(title ?? 'Notification'),
        showClose: false,
        modal: true,
        cancelAction: 'cancel'
    })
    w2utils.normButtons(options, { ok: 'Ok', cancel: 'Cancel' })
    if (query('#w2ui-popup').length > 0 && w2popup.status != 'closing') {
        prom = w2popup.message(options)
    } else {
        prom = w2popup.open(options)
    }
    if (prom.self.box) {
        prom.self.input = query(prom.self.box).find('#w2prompt').get(0)
    } else {
        prom.self.input = query('#w2ui-popup .w2ui-popup-body #w2prompt').get(0)
    }
    if (options.value !== null) {
        prom.self.input.select()
    }
    prom.change = function (callback) {
        prom.self.on('change', callback)
        return this
    }
    prom.self
        .off('.prompt')
        .on('open:after.prompt', (event) => {
            let box = event.detail.box ? event.detail.box : query('#w2ui-popup .w2ui-popup-body').get(0)
            w2utils.bindEvents(query(box).find('#w2prompt'), {
                keydown(evt) {
                    if (evt.keyCode == 27) evt.stopPropagation()
                },
                change(evt) {
                    let edata = prom.self.trigger('change', { target: 'prompt', originalEvent: evt })
                    if (edata.isCancelled === true) return
                    if (evt.keyCode == 13 && evt.ctrlKey) {
                        prom.self.action('Ok', evt)
                    }
                    if (evt.keyCode == 27) {
                        prom.self.action('Cancel', evt)
                    }
                    edata.finish()
                }
            })
            query(box).find('.w2ui-eaction').trigger('keyup')
        })
        .on('action:after.prompt', (event) => {
            if (typeof event.detail.self?.close == 'function') {
                event.detail.self.close();
            }
            if (typeof callBack == 'function') callBack(event.detail.action)
        })
    return prom
}
let w2popup = new Dialog()
/**
 * Part of w2ui 2.0 library
 * - Dependencies: mQuery, w2utils, w2base
 *
 * 2.0 Changes
 * - multiple tooltips to the same anchor
 *
 * TODO
 * - cleanup w2color less
 * - remember state for drop menu
 * - events firing too many times
 */

class Tooltip {
    // no need to extend w2base, as each individual tooltip extends it
    static active = {} // all defined tooltips
    constructor() {
        this.defaults = {
            name            : null,     // name for the overlay, otherwise input id is used
            html            : '',       // text or html
            style           : '',       // additional style for the overlay
            class           : '',       // add class for w2ui-tooltip-body
            position        : 'top|bottom',   // can be left, right, top, bottom
            align           : '',       // can be: both:size=50, left, right, both, top, bottom
            anchor          : null,     // element it is attached to, if anchor is body, then it is context menu
            anchorClass     : '',       // add class for anchor when tooltip is shown
            anchorStyle     : '',       // add style for anchor when tooltip is shown
            autoShow        : false,    // if autoShow true, then tooltip will show on mouseEnter and hide on mouseLeave
            autoShowOn      : null,     // when options.auto = true, mouse event to show on
            autoHideOn      : null,     // when options.auto = true, mouse event to hide on
            arrowSize       : 8,        // size of the carret
            margin          : 0,        // extra margin from the anchor
            screenMargin    : 2,        // min margin from screen to tooltip
            autoResize      : true,     // auto resize based on content size and available size
            offsetX         : 0,        // delta for left coordinate
            offsetY         : 0,        // delta for top coordinate
            maxWidth        : null,     // max width
            maxHeight       : null,     // max height
            watchScroll     : null,     // attach to onScroll event // TODO:
            watchResize     : null,     // attach to onResize event // TODO:
            hideOn          : null,     // events when to hide tooltip, ['click', 'change', 'key', 'focus', 'blur'],
            onThen          : null,     // called when displayed
            onShow          : null,     // callBack when shown
            onHide          : null,     // callBack when hidden
            onUpdate        : null,     // callback when tooltip gets updated
            onMove          : null      // callback when tooltip is moved
        }
    }
    trigger(event, data) {
        if (arguments.length == 2) {
            let type = event
            event = data
            data.type = type
        }
        if (event.overlay) {
            return event.overlay.trigger(event)
        } else {
            console.log('ERROR: cannot find overlay where to trigger events')
        }
    }
    get(name) {
        if (arguments.length == 0) {
            return Object.keys(Tooltip.active)
        } else if (name === true) {
            return Tooltip.active
        } else {
            return Tooltip.active[name.replace(/[\s\.#]/g, '_')]
        }
    }
    attach(anchor, text) {
        let options, overlay
        let self = this
        if (arguments.length == 0) {
            return
        } else if (arguments.length == 1 && anchor.anchor) {
            options = anchor
            anchor = options.anchor
        } else if (arguments.length === 2 && typeof text === 'string') {
            options = { anchor, html: text }
            text = options.html
        } else if (arguments.length === 2 && text != null && typeof text === 'object') {
            options = text
            text = options.html
        }
        options = w2utils.extend({}, this.defaults, options || {})
        if (!text && options.text) text = options.text
        if (!text && options.html) text = options.html
        // anchor is func var
        delete options.anchor
        // define tooltip
        let name = (options.name ? options.name : anchor.id)
        if (!name) {
            name = 'noname-' + Object.keys(Tooltip.active).length
            console.log('NOTICE: name property is not defined for tooltip, could lead to too many instances')
        }
        // clean name as it is used as id and css selector
        name = name.replace(/[\s\.#]/g, '_')
        // if (name == anchor.id && Tooltip.active[name]) {
        //     // find unique name
        //     let find = (name, ind = 0) => {
        //         if (ind !== 0) name = name.substr(0, name.length - 2)
        //         name += '-' + (ind + 1)
        //         return (Tooltip.active['w2overlay-' + name] == null ? name : find(name, ind + 1))
        //     }
        //     name = find(name)
        //     console.log(name)
        // }
        if (anchor == document || anchor == document.body) {
            anchor = document.body
            name = 'context-menu'
        }
        if (Tooltip.active[name]) {
            overlay = Tooltip.active[name]
            overlay.prevOptions = overlay.options
            overlay.options = options // do not merge or extend, otherwiser menu items get merged too
            // overlay.options = w2utils.extend({}, overlay.options, options)
            overlay.anchor  = anchor // as HTML elements are not copied
            if (overlay.prevOptions.html != overlay.options.html) {
                overlay.needsUpdate = true
            }
            options = overlay.options // it was recreated
        } else {
            overlay = new w2base()
            Object.assign(overlay, {
                displayed: false,
                id: 'w2overlay-' + name, name, options, anchor,
                tmp: {
                    resizeObserver: new ResizeObserver(() => {
                        this.resize(overlay.name)
                    })
                }
            })
            Tooltip.active[name] = overlay
        }
        // move events on to overlay layer
        Object.keys(overlay.options).forEach(key => {
            let val = overlay.options[key]
            if (key.startsWith('on') && typeof val == 'function') {
                overlay[key] = val
                delete overlay.options[key]
            }
        })
        // add event for auto show/hide
        if (options.autoShow === true) {
            options.autoShowOn = options.autoShowOn ?? 'mouseenter'
            options.autoHideOn = options.autoHideOn ?? 'mouseleave'
            options.autoShow = false
        }
        if (options.autoShowOn) {
            let scope = 'autoShow-' + overlay.name
            query(anchor)
                .off(`.${scope}`)
                .on(`${options.autoShowOn}.${scope}`, event => {
                    self.show(overlay.name)
                    event.stopPropagation()
                })
            delete options.autoShowOn
        }
        if (options.autoHideOn) {
            let scope = 'autoHide-' + overlay.name
            query(anchor)
                .off(`.${scope}`)
                .on(`${options.autoHideOn}.${scope}`, event => {
                    self.hide(overlay.name)
                    event.stopPropagation()
                })
            delete options.autoHideOn
        }
        overlay.off('.attach')
        let ret = {
            overlay,
            then: (callback) => {
                overlay.on('show:after.attach', event => { callback(event) })
                return ret
            },
            show: (callback) => {
                overlay.on('show.attach', event => { callback(event) })
                return ret
            },
            hide: (callback) => {
                overlay.on('hide.attach', event => { callback(event) })
                return ret
            },
            update: (callback) => {
                overlay.on('update.attach', event => { callback(event) })
                return ret
            },
            move: (callback) => {
                overlay.on('move.attach', event => { callback(event) })
                return ret
            }
        }
        return ret
    }
    show(name) {
        if (name instanceof HTMLElement || name instanceof Object) {
            let options = name
            if (name instanceof HTMLElement) {
                options = arguments[1] || {}
                options.anchor = name
            }
            let ret = this.attach(options)
            query(ret.overlay.anchor)
                .off('.autoShow-' + ret.overlay.name)
                .off('.autoHide-' + ret.overlay.name)
            // need a timer, so that events would be preperty set
            setTimeout(() => { this.show(ret.overlay.name) }, 1)
            return ret
        }
        let edata
        let self = this
        let overlay = Tooltip.active[name.replace(/[\s\.#]/g, '_')]
        let options = overlay.options
        if (!overlay || (overlay.displayed && !overlay.needsUpdate)) {
            return
        }
        let position = options.position.split('|')
        let isVertical = ['top', 'bottom'].includes(position[0])
        // enforce nowrap only when align=both and vertical
        let overlayStyles = (options.align == 'both' && isVertical ? '' : 'white-space: nowrap;')
        if (options.maxWidth && w2utils.getStrWidth(options.html, '') > options.maxWidth) {
            overlayStyles = 'width: '+ options.maxWidth + 'px; white-space: inherit; overflow: auto;'
        }
        overlayStyles += ' max-height: '+ (options.maxHeight ? options.maxHeight : window.innerHeight - 40) + 'px;'
        // if empty content - then hide it
        if (options.html === '' || options.html == null) {
            self.hide(name)
            return
        } else if (overlay.box) {
            // if already present, update it
            edata = this.trigger('update', {  target: name, overlay })
            if (edata.isCancelled === true) {
                // restore previous options
                if (overlay.prevOptions) {
                    overlay.options = overlay.prevOptions
                    delete overlay.prevOptions
                }
                return
            }
            query(overlay.box)
                .find('.w2ui-overlay-body')
                .attr('style', (options.style || '') + '; ' + overlayStyles)
                .removeClass() // removes all classes
                .addClass('w2ui-overlay-body ' + options.class)
                .html(options.html)
            this.resize(overlay.name)
        } else {
            // event before
            edata = this.trigger('show', { target: name, overlay })
            if (edata.isCancelled === true) return
            // normal processing
            query('body').append(
                `<div id="${overlay.id}" name="${name}" style="display: none;" class="w2ui-overlay"
                        data-click="stop" data-focusin="stop">
                    <style></style>
                    <div class="w2ui-overlay-body ${options.class}" style="${options.style || ''}; ${overlayStyles}">
                        ${options.html}
                    </div>
                </div>`)
            overlay.box = query('#'+w2utils.escapeId(overlay.id))[0]
            overlay.displayed = true
            let names = query(overlay.anchor).data('tooltipName') ?? []
            names.push(name)
            query(overlay.anchor).data('tooltipName', names) // make available to element overlay attached to
            w2utils.bindEvents(overlay.box, {})
            // remember anchor's original styles
            overlay.tmp.originalCSS = ''
            if (query(overlay.anchor).length > 0) {
                overlay.tmp.originalCSS = query(overlay.anchor)[0].style.cssText
            }
        }
        if (options.anchorStyle) {
            overlay.anchor.style.cssText += ';' + options.anchorStyle
        }
        if (options.anchorClass) {
            // do not add w2ui-focus to body
            if (!(options.anchorClass == 'w2ui-focus' && overlay.anchor == document.body)) {
                query(overlay.anchor).addClass(options.anchorClass)
            }
        }
        // add on hide events
        if (typeof options.hideOn == 'string') options.hideOn = [options.hideOn]
        if (!Array.isArray(options.hideOn)) options.hideOn = []
        // initial scroll
        Object.assign(overlay.tmp, {
            scrollLeft: document.body.scrollLeft,
            scrollTop: document.body.scrollTop
        })
        addHideEvents()
        addWatchEvents(document.body)
        // first show empty tooltip, so it will popup up in the right position
        query(overlay.box).show()
        overlay.tmp.resizeObserver.observe(overlay.box)
        // then insert html and it will adjust
        query(overlay.box)
            .find('.w2ui-overlay-body')
            .html(options.html)
        // now, make visible, it has css opacity transition
        setTimeout(() => { query(overlay.box).css('opacity', 1) }, 0)
        delete overlay.needsUpdate
        // event after
        if (edata) edata.finish()
        return
        function addWatchEvents(el) {
            let scope = 'tooltip-' + overlay.name
            let queryEl = el
            if (el.tagName == 'BODY') {
                queryEl = el.ownerDocument
            }
            query(queryEl)
                .off(`.${scope}`)
                .on(`scroll.${scope}`, event => {
                    Object.assign(overlay.tmp, {
                        scrollLeft: el.scrollLeft,
                        scrollTop: el.scrollTop
                    })
                    self.resize(overlay.name)
                })
        }
        function addHideEvents() {
            let hide = (event) => { self.hide(overlay.name) }
            let $anchor = query(overlay.anchor)
            let scope = 'tooltip-' + overlay.name
            // document click
            query('body').off(`.${scope}`)
            if (options.hideOn.includes('doc-click')) {
                if (['INPUT', 'TEXTAREA'].includes(overlay.anchor.tagName)) {
                    // otherwise hides on click to focus
                    $anchor
                        .off(`.${scope}-doc`)
                        .on(`click.${scope}-doc`, (event) => { event.stopPropagation() })
                }
                query('body').on(`click.${scope}`, hide)
            }
            if (options.hideOn.includes('focus-change')) {
                query('body')
                    .on(`focusin.${scope}`, (e) => {
                        if (document.activeElement != overlay.anchor) {
                            self.hide(overlay.name)
                        }
                    })
            }
            if (['INPUT', 'TEXTAREA'].includes(overlay.anchor.tagName)) {
                $anchor.off(`.${scope}`)
                options.hideOn.forEach(event => {
                    if (['doc-click', 'focus-change'].indexOf(event) == -1) {
                        $anchor.on(`${event}.${scope}`, { once: true }, hide)
                    }
                })
            }
        }
    }
    hide(name) {
        let overlay
        if (arguments.length == 0) {
            // hide all tooltips
            Object.keys(Tooltip.active).forEach(name => { this.hide(name) })
            return
        }
        if (name instanceof HTMLElement) {
            let names = query(name).data('tooltipName') ?? []
            names.forEach(name => { this.hide(name) })
            return
        }
        if (typeof name == 'string') {
            name = name.replace(/[\s\.#]/g, '_')
            overlay = Tooltip.active[name.replace(/[\s\.#]/g, '_')]
        }
        if (!overlay || !overlay.box) return
        // event before
        let edata = this.trigger('hide', { target: name, overlay })
        if (edata.isCancelled === true) return
        let scope = 'tooltip-' + overlay.name
        // normal processing
        overlay.tmp.resizeObserver?.disconnect()
        if (overlay.options.watchScroll) {
            query(overlay.options.watchScroll)
                .off('.w2scroll-' + overlay.name)
        }
        query('body').off(`.${scope}`)   // hide to click event here
        query(document).off(`.${scope}`) // scroll event here
        // remove element
        overlay.box.remove()
        overlay.box = null
        overlay.displayed = false
        // remove name from anchor properties
        let names = query(overlay.anchor).data('tooltipName') ?? []
        let ind = names.indexOf(overlay.name)
        if (ind != -1) names.splice(names.indexOf(overlay.name), 1)
        if (names.length == 0) {
            query(overlay.anchor).removeData('tooltipName')
        } else {
            query(overlay.anchor).data('tooltipName', names)
        }
        // restore original CSS
        overlay.anchor.style.cssText = overlay.tmp.originalCSS
        query(overlay.anchor)
            .off(`.${scope}`)
            .removeClass(overlay.options.anchorClass)
        // event after
        edata.finish()
    }
    resize(name) {
        if (arguments.length == 0) {
            Object.keys(Tooltip.active).forEach(key => {
                let overlay = Tooltip.active[key]
                if (overlay.displayed) this.resize(overlay.name)
            })
            return
        }
        let overlay = Tooltip.active[name.replace(/[\s\.#]/g, '_')]
        let pos = this.getPosition(overlay.name)
        let newPos = pos.left + 'x' + pos.top
        let edata
        if (overlay.tmp.lastPos != newPos) {
            edata = this.trigger('move', { target: name, overlay, pos })
        }
        query(overlay.box)
            .css({
                left: pos.left + 'px',
                top : pos.top + 'px'
            })
            .then(query => {
                if (pos.width != null) {
                    query.css('width', pos.width + 'px')
                         .find('.w2ui-overlay-body')
                         .css('width', '100%')
                }
                if (pos.height != null) {
                    query.css('height', pos.height + 'px')
                         .find('.w2ui-overlay-body')
                         .css('height', '100%')
                }
            })
            .find('.w2ui-overlay-body')
            .removeClass('w2ui-arrow-right w2ui-arrow-left w2ui-arrow-top w2ui-arrow-bottom')
            .addClass(pos.arrow.class)
            .closest('.w2ui-overlay')
            .find('style')
            .text(pos.arrow.style)
        if (overlay.tmp.lastPos != newPos && edata) {
            overlay.tmp.lastPos = newPos
            edata.finish()
        }
    }
    getPosition(name) {
        let overlay = Tooltip.active[name.replace(/[\s\.#]/g, '_')]
        if (!overlay || !overlay.box) {
            return
        }
        let options = overlay.options
        if (overlay.tmp.resizedY || overlay.tmp.resizedX) {
            query(overlay.box).css({ width: '', height: '' })
        }
        let scrollSize = w2utils.scrollBarSize()
        let hasScrollBarX = !(document.body.scrollWidth == document.body.clientWidth)
        let hasScrollBarY = !(document.body.scrollHeight == document.body.clientHeight)
        let max = {
            width: window.innerWidth - (hasScrollBarY ? scrollSize : 0),
            height: window.innerHeight - (hasScrollBarX ? scrollSize : 0)
        }
        let position   = options.position == 'auto' ? 'top|bottom|right|left'.split('|') : options.position.split('|')
        let isVertical = ['top', 'bottom'].includes(position[0])
        let content    = overlay.box.getBoundingClientRect()
        let anchor     = overlay.anchor.getBoundingClientRect()
        if (overlay.anchor == document.body) {
            // context menu
            let { x, y, width, height } = options.originalEvent
            anchor = { left: x - 2, top: y - 4, width, height, arrow: 'none' }
        }
        let arrowSize = options.arrowSize
        if (anchor.arrow == 'none') arrowSize = 0
        // space available
        let available = { // tipsize adjustment should be here, not in max.width/max.height
            top: anchor.top - arrowSize,
            bottom: max.height - (anchor.top + anchor.height) - arrowSize,
            left: anchor.left - arrowSize,
            right: max.width - (anchor.left + anchor.width) - arrowSize,
        }
        // size of empty tooltip
        if (content.width < 22) content.width = 22
        if (content.height < 14) content.height = 14
        let left, top, width, height // tooltip position
        let found = ''
        let arrow = {
            offset: 0,
            class: '',
            style: `#${overlay.id} { --tip-size: ${arrowSize}px; }`
        }
        let adjust   = { left: 0, top: 0 }
        let bestFit  = { posX: '', x: 0, posY: '', y: 0 }
        // find best position
        position.forEach(pos => {
            if (['top', 'bottom'].includes(pos)) {
                if (!found && (content.height + arrowSize) < available[pos]) {
                    found = pos
                }
                if (available[pos] > bestFit.y) {
                    Object.assign(bestFit, { posY: pos, y: available[pos] })
                }
            }
            if (['left', 'right'].includes(pos)) {
                if (!found && (content.width + arrowSize) < available[pos]) {
                    found = pos
                }
                if (available[pos] > bestFit.x) {
                    Object.assign(bestFit, { posX: pos, x: available[pos] })
                }
            }
        })
        // if not found, use best (greatest available space) position
        if (!found) {
            if (isVertical) {
                found = bestFit.posY
            } else {
                found = bestFit.posX
            }
        }
        if (options.autoResize) {
            if (['top', 'bottom'].includes(found)) {
                if (content.height > available[found]) {
                    height = available[found]
                    overlay.tmp.resizedY = true
                } else {
                    overlay.tmp.resizedY = false
                }
            }
            if (['left', 'right'].includes(found)) {
                if (content.width > available[found]) {
                    width = available[found]
                    overlay.tmp.resizedX = true
                } else {
                    overlay.tmp.resizedX = false
                }
            }
        }
        usePosition(found)
        anchorAlignment()
        screenAdjust()
        let extraTop = (found == 'top' ? -options.margin : (found == 'bottom' ? options.margin : 0))
        let extraLeft = (found == 'left' ? -options.margin : (found == 'right' ? options.margin : 0))
        // adjust for scrollbar
        top = top + parseFloat(options.offsetY) + parseInt(extraTop)
        left = left + parseFloat(options.offsetX) + parseInt(extraLeft)
        return { left, top, arrow, adjust, width, height, pos: found }
        function usePosition(pos) {
            arrow.class = anchor.arrow ? anchor.arrow : `w2ui-arrow-${pos}`
            switch (pos) {
                case 'top': {
                    left = anchor.left + (anchor.width - (width ?? content.width)) / 2
                    top = anchor.top - (height ?? content.height) - arrowSize
                    break
                }
                case 'bottom': {
                    left = anchor.left + (anchor.width - (width ?? content.width)) / 2
                    top = anchor.top + anchor.height + arrowSize
                    break
                }
                case 'left': {
                    left = anchor.left - (width ?? content.width) - arrowSize
                    top = anchor.top + (anchor.height - (height ?? content.height)) / 2
                    break
                }
                case 'right': {
                    left = anchor.left + anchor.width + arrowSize
                    top = anchor.top + (anchor.height - (height ?? content.height)) / 2
                    break
                }
            }
        }
        function anchorAlignment() {
            // top/bottom alignments
            if (options.align == 'left') {
                adjust.left = anchor.left - left
                left = anchor.left
            }
            if (options.align == 'right') {
                adjust.left = (anchor.left + anchor.width - (width ?? content.width)) - left
                left = anchor.left + anchor.width - (width ?? content.width)
            }
            if (['top', 'bottom'].includes(found) && options.align.startsWith('both')) {
                let minWidth = options.align.split(':')[1] ?? 50
                if (anchor.width >= minWidth) {
                    left = anchor.left
                    width = anchor.width
                }
            }
            // left/right alignments
            if (options.align == 'top') {
                adjust.top = anchor.top - top
                top = anchor.top
            }
            if (options.align == 'bottom') {
                adjust.top = (anchor.top + anchor.height - (height ?? content.height)) - top
                top = anchor.top + anchor.height - (height ?? content.height)
            }
            if (['left', 'right'].includes(found) && options.align.startsWith('both')) {
                let minHeight = options.align.split(':')[1] ?? 50
                if (anchor.height >= minHeight) {
                    top = anchor.top
                    height = anchor.height
                }
            }
        }
        function screenAdjust() {
            let adjustArrow
            // adjust tip if needed after alignment
            if ((['left', 'right'].includes(options.align) && anchor.width < (width ?? content.width))
                || (['top', 'bottom'].includes(options.align) && anchor.height < (height ?? content.height))
            ) {
                adjustArrow = true
            }
            // if off screen then adjust
            let minLeft = (found == 'right' ? arrowSize : options.screenMargin)
            let minTop  = (found == 'bottom' ? arrowSize : options.screenMargin)
            let maxLeft = max.width - (width ?? content.width) - (found == 'left' ? arrowSize : options.screenMargin)
            let maxTop  = max.height - (height ?? content.height) - (found == 'top' ? arrowSize : options.screenMargin)
            // adjust X
            if (['top', 'bottom'].includes(found) || options.autoResize) {
                if (left < minLeft) {
                    adjustArrow = true
                    adjust.left -= left
                    left = minLeft
                }
                if (left > maxLeft) {
                    adjustArrow = true
                    adjust.left -= left - maxLeft
                    left += maxLeft - left
                }
            }
            // adjust Y
            if (['left', 'right'].includes(found) || options.autoResize) {
                if (top < minTop) {
                    adjustArrow = true
                    adjust.top -= top
                    top = minTop
                }
                if (top > maxTop) {
                    adjustArrow = true
                    adjust.top -= top - maxTop
                    top += maxTop - top
                }
            }
            if (adjustArrow) {
                let aType = 'top'
                let sType = 'height'
                if (isVertical) {
                    aType = 'left'
                    sType = 'width'
                }
                arrow.offset = -adjust[aType]
                let maxOffset = content[sType] / 2 - arrowSize
                if (Math.abs(arrow.offset) > maxOffset + arrowSize) {
                    arrow.class = '' // no arrow
                }
                if (Math.abs(arrow.offset) > maxOffset) {
                    arrow.offset = arrow.offset < 0 ? -maxOffset : maxOffset
                }
                arrow.style = `#${overlay.id} .w2ui-overlay-body:after,
                            #${overlay.id} .w2ui-overlay-body:before {
                                --tip-size: ${arrowSize}px;
                                margin-${aType}: ${arrow.offset}px;
                            }`
            }
        }
    }
}
class ColorTooltip extends Tooltip {
    constructor() {
        super()
        this.palette = [
            ['000000', '333333', '555555', '777777', '888888', '999999', 'AAAAAA', 'CCCCCC', 'DDDDDD', 'EEEEEE', 'F7F7F7', 'FFFFFF'],
            ['FF011B', 'FF9838', 'FFC300', 'FFFD59', '86FF14', '14FF7A', '2EFFFC', '2693FF', '006CE7', '9B24F4', 'FF21F5', 'FF0099'],
            ['FFEAEA', 'FCEFE1', 'FCF4DC', 'FFFECF', 'EBFFD9', 'D9FFE9', 'E0FFFF', 'E8F4FF', 'ECF4FC', 'EAE6F4', 'FFF5FE', 'FCF0F7'],
            ['F4CCCC', 'FCE5CD', 'FFF1C2', 'FFFDA1', 'D5FCB1', 'B5F7D0', 'BFFFFF', 'D6ECFF', 'CFE2F3', 'D9D1E9', 'FFE3FD', 'FFD9F0'],
            ['EA9899', 'F9CB9C', 'FFE48C', 'F7F56F', 'B9F77E', '84F0B1', '83F7F7', 'B5DAFF', '9FC5E8', 'B4A7D6', 'FAB9F6', 'FFADDE'],
            ['E06666', 'F6B26B', 'DEB737', 'E0DE51', '8FDB48', '52D189', '4EDEDB', '76ACE3', '6FA8DC', '8E7CC3', 'E07EDA', 'F26DBD'],
            ['CC0814', 'E69138', 'AB8816', 'B5B20E', '6BAB30', '27A85F', '1BA8A6', '3C81C7', '3D85C6', '674EA7', 'A14F9D', 'BF4990'],
            ['99050C', 'B45F17', '80650E', '737103', '395E14', '10783D', '13615E', '094785', '0A5394', '351C75', '780172', '782C5A']
        ]
        this.defaults = w2utils.extend({}, this.defaults, {
            advanced    : false,
            transparent : true,
            position    : 'top|bottom',
            class       : 'w2ui-white',
            color       : '',
            liveUpdate  : true,
            arrowSize   : 12,
            autoResize  : false,
            anchorClass : 'w2ui-focus',
            autoShowOn  : 'focus',
            hideOn      : ['doc-click', 'focus-change'],
            onSelect    : null,
            onLiveUpdate: null
        })
    }
    attach(anchor, text) {
        let options
        if (arguments.length == 1 && anchor.anchor) {
            options = anchor
            anchor = options.anchor
        } else if (arguments.length === 2 && text != null && typeof text === 'object') {
            options = text
            options.anchor = anchor
        }
        let prevHideOn = options.hideOn
        options = w2utils.extend({}, this.defaults, options || {})
        if (prevHideOn) {
            options.hideOn = prevHideOn
        }
        options.style += '; padding: 0;'
        // add remove transparent color
        if (options.transparent && this.palette[0][1] == '333333') {
            this.palette[0].splice(1, 1)
            this.palette[0].push('')
        }
        if (!options.transparent && this.palette[0][1] != '333333') {
            this.palette[0].splice(1, 0, '333333')
            this.palette[0].pop()
        }
        if (options.color) options.color = String(options.color).toUpperCase()
        if (typeof options.color === 'string' && options.color.substr(0,1) === '#') options.color = options.color.substr(1)
        // needed for keyboard navigation
        this.index = [-1, -1]
        options.html = this.getColorHTML(options)
        let ret = super.attach(options)
        let overlay = ret.overlay
        overlay.on('show.attach', event => {
            let overlay = event.detail.overlay
            let anchor  = overlay.anchor
            let options = overlay.options
            if (['INPUT', 'TEXTAREA'].includes(anchor.tagName) && !options.color && anchor.value) {
                overlay.tmp.initColor = anchor.value
            }
            delete overlay.newColor
        })
        overlay.on('show:after.attach', event => {
            if (ret.overlay?.box) {
                let actions = query(ret.overlay.box).find('.w2ui-eaction')
                w2utils.bindEvents(actions, this)
                this.initControls(ret.overlay)
            }
        })
        overlay.on('update:after.attach', event => {
            if (ret.overlay?.box) {
                let actions = query(ret.overlay.box).find('.w2ui-eaction')
                w2utils.bindEvents(actions, this)
                this.initControls(ret.overlay)
            }
        })
        overlay.on('hide.attach', event => {
            let overlay = event.detail.overlay
            let anchor  = overlay.anchor
            let color   = overlay.newColor ?? overlay.options.color ?? ''
            if (['INPUT', 'TEXTAREA'].includes(anchor.tagName) && anchor.value != color) {
                anchor.value = color
            }
            let edata = this.trigger('select', { color, target: overlay.name, overlay })
            if (edata.isCancelled === true) return
            // event after
            edata.finish()
        })
        ret.liveUpdate = (callback) => {
            overlay.on('liveUpdate.attach', (event) => { callback(event) })
            return ret
        }
        ret.select = (callback) => {
            overlay.on('select.attach', (event) => { callback(event) })
            return ret
        }
        return ret
    }
    // regular panel handler, adds selection class
    select(color, name) {
        let target
        this.index = [-1, -1]
        if (typeof name != 'string') {
            target = name.target
            this.index = query(target).attr('index').split(':')
            name = query(target).closest('.w2ui-overlay').attr('name')
        }
        let overlay = this.get(name)
        // event before
        let edata = this.trigger('liveUpdate', { color, target: name, overlay, param: arguments[1] })
        if (edata.isCancelled === true) return
        // if anchor is input - live update
        if (['INPUT', 'TEXTAREA'].includes(overlay.anchor.tagName) && overlay.options.liveUpdate) {
            query(overlay.anchor).val(color)
        }
        overlay.newColor = color
        query(overlay.box).find('.w2ui-selected').removeClass('w2ui-selected')
        if (target) {
            query(target).addClass('w2ui-selected')
        }
        // event after
        edata.finish()
    }
    // used for keyboard navigation, if any
    nextColor(direction) { // TODO: check it
        let pal = this.palette
        switch (direction) {
            case 'up':
                index[0]--
                break
            case 'down':
                index[0]++
                break
            case 'right':
                index[1]++
                break
            case 'left':
                index[1]--
                break
        }
        if (index[0] < 0) index[0] = 0
        if (index[0] > pal.length - 2) index[0] = pal.length - 2
        if (index[1] < 0) index[1] = 0
        if (index[1] > pal[0].length - 1) index[1] = pal[0].length - 1
        return pal[index[0]][index[1]]
    }
    tabClick(index, name) {
        if (typeof name != 'string') {
            name = query(name.target).closest('.w2ui-overlay').attr('name')
        }
        let overlay = this.get(name)
        let tab = query(overlay.box).find(`.w2ui-color-tab:nth-child(${index})`)
        query(overlay.box).find('.w2ui-color-tab').removeClass('selected')
        query(tab).addClass('selected')
        query(overlay.box)
            .find('.w2ui-tab-content')
            .hide()
            .closest('.w2ui-colors')
            .find('.tab-'+ index)
            .show()
    }
    // generate HTML with color pallent and controls
    getColorHTML(options) {
        let html = `
            <div class="w2ui-colors">
                <div class="w2ui-tab-content tab-1">`
        for (let i = 0; i < this.palette.length; i++) {
            html += '<div class="w2ui-color-row">'
            for (let j = 0; j < this.palette[i].length; j++) {
                let color = this.palette[i][j]
                let border = ''
                if (color === 'FFFFFF') border = '; border: 1px solid #efefef'
                html += `
                    <div class="w2ui-color w2ui-eaction ${color === '' ? 'w2ui-no-color' : ''} ${options.color == color ? 'w2ui-selected' : ''}"
                        style="background-color: #${color + border};" name="${color}" index="${i}:${j}"
                        data-mousedown="select|'${color}'|event" data-mouseup="hide">&nbsp;
                    </div>`
            }
            html += '</div>'
            if (i < 2) html += '<div style="height: 8px"></div>'
        }
        html += '</div>'
        // advanced tab
        html += `
            <div class="w2ui-tab-content tab-2" style="display: none">
                <div class="color-info">
                    <div class="color-preview-bg"><div class="color-preview"></div><div class="color-original"></div></div>
                    <div class="color-part">
                        <span>H</span> <input class="w2ui-input" name="h" maxlength="3" max="360" tabindex="101">
                        <span>R</span> <input class="w2ui-input" name="r" maxlength="3" max="255" tabindex="104">
                    </div>
                    <div class="color-part">
                        <span>S</span> <input class="w2ui-input" name="s" maxlength="3" max="100" tabindex="102">
                        <span>G</span> <input class="w2ui-input" name="g" maxlength="3" max="255" tabindex="105">
                    </div>
                    <div class="color-part">
                        <span>V</span> <input class="w2ui-input" name="v" maxlength="3" max="100" tabindex="103">
                        <span>B</span> <input class="w2ui-input" name="b" maxlength="3" max="255" tabindex="106">
                    </div>
                    <div class="color-part opacity">
                        <span>${w2utils.lang('Opacity')}</span>
                        <input class="w2ui-input" name="a" maxlength="5" max="1" tabindex="107">
                    </div>
                </div>
                <div class="palette" name="palette">
                    <div class="palette-bg"></div>
                    <div class="value1 move-x move-y"></div>
                </div>
                <div class="rainbow" name="rainbow">
                    <div class="value2 move-x"></div>
                </div>
                <div class="alpha" name="alpha">
                    <div class="alpha-bg"></div>
                    <div class="value2 move-x"></div>
                </div>
            </div>`
        // color tabs on the bottom
        html += `
            <div class="w2ui-color-tabs">
                <div class="w2ui-color-tab selected w2ui-eaction" data-click="tabClick|1|event|this"><span class="w2ui-icon w2ui-icon-colors"></span></div>
                <div class="w2ui-color-tab w2ui-eaction" data-click="tabClick|2|event|this"><span class="w2ui-icon w2ui-icon-settings"></span></div>
                <div style="padding: 5px; width: 100%; text-align: right;">
                    ${(typeof options.html == 'string' ? options.html : '')}
                </div>
            </div>`
        return html
    }
    // bind advanced tab controls
    initControls(overlay) {
        let initial // used for mouse events
        let self = this
        let options = overlay.options
        let rgb = w2utils.parseColor(options.color || overlay.tmp.initColor)
        if (rgb == null) {
            rgb = { r: 140, g: 150, b: 160, a: 1 }
        }
        let hsv = w2utils.rgb2hsv(rgb)
        if (options.advanced === true) {
            this.tabClick(2, overlay.name)
        }
        setColor(hsv, true, true)
        // even for rgb, hsv inputs
        query(overlay.box).find('input')
            .off('.w2color')
            .on('change.w2color', (event) => {
                let el = query(event.target)
                let val = parseFloat(el.val())
                let max = parseFloat(el.attr('max'))
                if (isNaN(val)) {
                    val = 0
                    el.val(0)
                }
                if (max > 1) val = parseInt(val) // trancate fractions
                if (max > 0 && val > max) {
                    el.val(max)
                    val = max
                }
                if (val < 0) {
                    el.val(0)
                    val = 0
                }
                let name  = el.attr('name')
                let color = {}
                if (['r', 'g', 'b', 'a'].indexOf(name) !== -1) {
                    rgb[name] = val
                    hsv = w2utils.rgb2hsv(rgb)
                } else if (['h', 's', 'v'].indexOf(name) !== -1) {
                    color[name] = val
                }
                setColor(color, true)
            })
        // click on original color resets it
        query(overlay.box).find('.color-original')
            .off('.w2color')
            .on('click.w2color', (event) => {
                let tmp = w2utils.parseColor(query(event.target).css('background-color'))
                if (tmp != null) {
                    rgb = tmp
                    hsv = w2utils.rgb2hsv(rgb)
                    setColor(hsv, true)
                }
            })
        // color sliders events
        let mDown = `${!w2utils.isIOS ? 'mousedown' : 'touchstart'}.w2color`
        let mUp   = `${!w2utils.isIOS ? 'mouseup' : 'touchend'}.w2color`
        let mMove = `${!w2utils.isIOS ? 'mousemove' : 'touchmove'}.w2color`
        query(overlay.box).find('.palette, .rainbow, .alpha')
            .off('.w2color')
            .on(`${mDown}.w2color`, mouseDown)
        return;
        function setColor(color, fullUpdate, initial) {
            if (color.h != null) hsv.h = color.h
            if (color.s != null) hsv.s = color.s
            if (color.v != null) hsv.v = color.v
            if (color.a != null) { rgb.a = color.a; hsv.a = color.a }
            rgb = w2utils.hsv2rgb(hsv)
            let newColor = 'rgba('+ rgb.r +','+ rgb.g +','+ rgb.b +','+ rgb.a +')'
            let cl       = [
                Number(rgb.r).toString(16).toUpperCase(),
                Number(rgb.g).toString(16).toUpperCase(),
                Number(rgb.b).toString(16).toUpperCase(),
                (Math.round(Number(rgb.a)*255)).toString(16).toUpperCase()
            ]
            cl.forEach((item, ind) => { if (item.length === 1) cl[ind] = '0' + item })
            newColor = cl[0] + cl[1] + cl[2] + cl[3]
            if (rgb.a === 1) {
                newColor = cl[0] + cl[1] + cl[2]
            }
            query(overlay.box).find('.color-preview').css('background-color', '#' + newColor)
            query(overlay.box).find('input').each(el => {
                if (el.name) {
                    if (rgb[el.name] != null) el.value = rgb[el.name]
                    if (hsv[el.name] != null) el.value = hsv[el.name]
                    if (el.name === 'a') el.value = rgb.a
                }
            })
            // if it is in pallette
            if (initial) {
                let color = overlay.tmp?.initColor || newColor
                query(overlay.box).find('.color-original')
                    .css('background-color', '#'+color)
                query(overlay.box).find('.w2ui-colors .w2ui-selected')
                    .removeClass('w2ui-selected')
                query(overlay.box).find(`.w2ui-colors [name="${color}"]`)
                    .addClass('w2ui-selected')
                // if has transparent color, open advanced tab
                if (newColor.length == 8) {
                    self.tabClick(2, overlay.name)
                }
            } else {
                self.select(newColor, overlay.name)
            }
            if (fullUpdate) {
                updateSliders()
                refreshPalette()
            }
        }
        function updateSliders() {
            let el1 = query(overlay.box).find('.palette .value1')
            let el2 = query(overlay.box).find('.rainbow .value2')
            let el3 = query(overlay.box).find('.alpha .value2')
            let offset1 = parseInt(el1[0].clientWidth) / 2
            let offset2 = parseInt(el2[0].clientWidth) / 2
            el1.css({
                'left': hsv.s * 150 / 100 - offset1,
                'top': (100 - hsv.v) * 125 / 100 - offset1
            })
            el2.css('left', hsv.h/(360/150) - offset2)
            el3.css('left', rgb.a*150 - offset2)
        }
        function refreshPalette() {
            let cl  = w2utils.hsv2rgb(hsv.h, 100, 100)
            let rgb = `${cl.r},${cl.g},${cl.b}`
            query(overlay.box).find('.palette')
                .css('background-image', `linear-gradient(90deg, rgba(${rgb},0) 0%, rgba(${rgb},1) 100%)`)
        }
        function mouseDown(event) {
            let el = query(this).find('.value1, .value2')
            let offset = parseInt(el.prop('clientWidth')) / 2
            if (el.hasClass('move-x')) el.css({ left: (event.offsetX - offset) + 'px' })
            if (el.hasClass('move-y')) el.css({ top: (event.offsetY - offset) + 'px' })
            initial = {
                el    : el,
                x      : event.pageX,
                y      : event.pageY,
                width  : el.prop('parentNode').clientWidth,
                height : el.prop('parentNode').clientHeight,
                left   : parseInt(el.css('left')),
                top    : parseInt(el.css('top'))
            }
            mouseMove(event)
            query('body')
                .off('.w2color')
                .on(mMove, mouseMove)
                .on(mUp, mouseUp)
        }
        function mouseUp(event) {
            query('body').off('.w2color')
        }
        function mouseMove(event) {
            let el    = initial.el
            let divX   = event.pageX - initial.x
            let divY   = event.pageY - initial.y
            let newX   = initial.left + divX
            let newY   = initial.top + divY
            let offset = parseInt(el.prop('clientWidth')) / 2
            if (newX < -offset) newX = -offset
            if (newY < -offset) newY = -offset
            if (newX > initial.width - offset) newX = initial.width - offset
            if (newY > initial.height - offset) newY = initial.height - offset
            if (el.hasClass('move-x')) el.css({ left : newX + 'px' })
            if (el.hasClass('move-y')) el.css({ top : newY + 'px' })
            // move
            let name = query(el.get(0).parentNode).attr('name')
            let x    = parseInt(el.css('left')) + offset
            let y    = parseInt(el.css('top')) + offset
            if (name === 'palette') {
                setColor({
                    s: Math.round(x / initial.width * 100),
                    v: Math.round(100 - (y / initial.height * 100))
                })
            }
            if (name === 'rainbow') {
                let h = Math.round(360 / 150 * x)
                setColor({ h: h })
                refreshPalette()
            }
            if (name === 'alpha') {
                setColor({ a: parseFloat(Number(x / 150).toFixed(2)) })
            }
        }
    }
}
class MenuTooltip extends Tooltip {
    constructor() {
        super()
        // ITEM STRUCTURE
        // item : {
        //   id       : null,
        //   text     : '',
        //   style    : '',
        //   icon     : '',
        //   count    : '',
        //   tooltip  : '',
        //   hotkey   : '',
        //   remove   : false,
        //   items    : []
        //   indent   : 0,
        //   type     : null,    // check/radio
        //   group    : false,   // groupping for checks
        //   expanded : false,
        //   hidden   : false,
        //   checked  : null,
        //   disabled : false
        //   ...
        // }
        this.defaults = w2utils.extend({}, this.defaults, {
            type        : 'normal',    // can be normal, radio, check
            items       : [],
            index       : null,        // current selected
            render      : null,
            spinner     : false,
            msgNoItems  : w2utils.lang('No items found'),
            topHTML     : '',
            menuStyle   : '',
            filter      : false,
            match       : 'contains',   // is, begins, ends, contains
            search      : false,         // top search
            altRows     : false,
            arrowSize   : 10,
            align       : 'left',
            position    : 'bottom|top',
            class       : 'w2ui-white',
            anchorClass : 'w2ui-focus',
            autoShowOn  : 'focus',
            hideOn      : ['doc-click', 'focus-change', 'select'], // also can 'item-remove'
            onSelect    : null,
            onSubMenu   : null,
            onRemove    : null
        })
    }
    attach(anchor, text) {
        let options
        if (arguments.length == 1 && anchor.anchor) {
            options = anchor
            anchor = options.anchor
        } else if (arguments.length === 2 && text != null && typeof text === 'object') {
            options = text
            options.anchor = anchor
        }
        let prevHideOn = options.hideOn
        options = w2utils.extend({}, this.defaults, options || {})
        if (prevHideOn) {
            options.hideOn = prevHideOn
        }
        options.style += '; padding: 0;'
        if (!Array.isArray(options.items) && typeof options.items != 'function') {
            options.items = []
        }
        options.html = this.getMenuHTML(options)
        let ret = super.attach(options)
        let overlay = ret.overlay
        overlay.on('show:after.attach, update:after.attach', event => {
            if (ret.overlay?.box) {
                let search = ''
                if (['INPUT', 'TEXTAREA'].includes(overlay.anchor.tagName)) {
                    search = overlay.anchor.value
                }
                let actions = query(ret.overlay.box).find('.w2ui-eaction')
                w2utils.bindEvents(actions, this)
                this.applyFilter(overlay.name)
                this.refreshSearch(overlay.name)
                this.initControls(ret.overlay)
                // reset selected and active chain
                overlay.selected = null
            }
        })
        overlay.on('hide:after.attach', event => {
            w2tooltip.hide(overlay.name + '-tooltip')
        })
        ret.select = (callback) => {
            overlay.on('select.attach', (event) => { callback(event) })
            return ret
        }
        ret.remove = (callback) => {
            overlay.on('remove.attach', (event) => { callback(event) })
            return ret
        }
        ret.subMenu = (callback) => {
            overlay.on('subMenu.attach', (event) => { callback(event) })
            return ret
        }
        return ret
    }
    initControls(overlay) {
        query(overlay.box).find('.w2ui-menu:not(.w2ui-sub-menu)')
            .off('.w2menu')
            .on('mouseDown.w2menu', { delegate: '.w2ui-menu-item' }, event => {
                let dt = event.delegate.dataset
                this.menuDown(overlay, event, dt.index, dt.parents)
            })
            .on((w2utils.isIOS ? 'touchStart' : 'click') + '.w2menu', { delegate: '.w2ui-menu-item' }, event => {
                let dt = event.delegate.dataset
                this.menuClick(overlay, event, dt.index, dt.parents)
            })
            .find('.w2ui-menu-item')
            .off('.w2menu')
            .on('mouseEnter.w2menu', event => {
                let dt = event.target.dataset
                let tooltip = overlay.options.items[dt.index]?.tooltip
                if (tooltip) {
                    w2tooltip.show({
                        name: overlay.name + '-tooltip',
                        anchor: event.target,
                        html: tooltip,
                        position: 'right|left',
                        hideOn: ['doc-click']
                    })
                }
            })
            .on('mouseLeave.w2menu', event => {
                w2tooltip.hide(overlay.name + '-tooltip')
            })
        if (['INPUT', 'TEXTAREA'].includes(overlay.anchor.tagName)) {
            query(overlay.anchor)
                .off('.w2menu')
                .on('input.w2menu', event => {
                    // if user types, clear selection
                    let dt = event.target.dataset
                    delete dt.selected
                    delete dt.selectedIndex
                })
                .on('keyup.w2menu', event => {
                    event._searchType = 'filter'
                    this.keyUp(overlay, event)
                })
        }
        if (overlay.options.search) {
            query(overlay.box).find('#menu-search')
                .off('.w2menu')
                .on('keyup.w2menu', event => {
                    event._searchType = 'search'
                    this.keyUp(overlay, event)
                })
        }
    }
    getCurrent(name, id) {
        let overlay  = Tooltip.active[name.replace(/[\s\.#]/g, '_')]
        let options  = overlay.options
        let selected = (id ? id : overlay.selected ?? '').split('-')
        let last     = selected.length-1
        let index    = selected[last]
        let parents  = selected.slice(0, selected.length-1).join('-')
        index = w2utils.isInt(index) ? parseInt(index) : 0
        // items
        let items = w2utils.normMenu(options.items)
        selected.forEach((id, ind) => {
            // do not go to the last one
            if (ind < selected.length - 1) {
                items = w2utils.normMenu(items[id].items)
            }
        })
        return { last, index, items, item: items[index], parents }
    }
    getMenuHTML(options, items, subMenu, parentIndex) {
        if (options.spinner) {
            return `
            <div class="w2ui-menu">
                <div class="w2ui-no-items">
                    <div class="w2ui-spinner"></div>
                    ${w2utils.lang('Loading...')}
                </div>
            </div>`
        }
        if (!parentIndex) parentIndex = []
        if (items == null) {
            items = options.items
        }
        items = w2utils.normMenu(items)
        if (!Array.isArray(items)) items = []
        let count = 0
        let icon = null
        let topHTML = ''
        if (!subMenu && options.search) {
            topHTML += `
                <div class="w2ui-menu-search">
                    <span class="w2ui-icon w2ui-icon-search"></span>
                    <input id="menu-search" class="w2ui-input" type="text"/>
                </div>`
            items.forEach(item => item.hidden = false)
        }
        if (!subMenu && options.topHTML) {
            topHTML += `<div class="w2ui-menu-top">${options.topHTML}</div>`
        }
        let menu_html = `
            ${topHTML}
            <div class="w2ui-menu ${(subMenu ? 'w2ui-sub-menu' : '')}" ${!subMenu ? `style="${options.menuStyle}"` : ''}>
        `
        items.forEach((mitem, f) => {
            icon = mitem.icon
            let index = (parentIndex.length > 0 ? parentIndex.join('-') + '-' : '') + f
            if (icon == null) icon = null // icon might be undefined
            if (['radio', 'check'].indexOf(options.type) != -1 && !Array.isArray(mitem.items) && mitem.group !== false) {
                if (mitem.checked === true) icon = 'w2ui-icon-check'; else icon = 'w2ui-icon-empty'
            }
            if (mitem.hidden !== true) {
                let txt  = mitem.text
                let icon_dsp = ''
                let subMenu_dsp = ''
                if (typeof options.render === 'function') txt = options.render(mitem, options)
                if (typeof txt == 'function') txt = txt(mitem, options)
                if (icon) icon_dsp = '<div class="menu-icon"><span class="w2ui-icon '+ icon +'"></span></div>'
                // render only if non-empty
                if (mitem.type !== 'break' && txt != null && txt !== '' && String(txt).substr(0, 2) != '--') {
                    let classes = ['w2ui-menu-item']
                    if (options.altRows == true) {
                        classes.push(count % 2 === 0 ? 'w2ui-even' : 'w2ui-odd')
                    }
                    let colspan = 1
                    if (icon_dsp === '') colspan++
                    if (mitem.count == null && mitem.hotkey == null && mitem.remove !== true && mitem.items == null) colspan++
                    if (mitem.tooltip == null && mitem.hint != null) mitem.tooltip = mitem.hint // for backward compatibility
                    let count_dsp = ''
                    if (mitem.remove === true) {
                        count_dsp = '<span class="remove">x</span>'
                    } else if (mitem.items != null) {
                        let _items = []
                        if (typeof mitem.items == 'function') {
                            _items = mitem.items(mitem)
                        } else if (Array.isArray(mitem.items)) {
                            _items = mitem.items
                        }
                        count_dsp   = '<span></span>'
                        subMenu_dsp = `
                            <div class="w2ui-sub-menu-box" style="${mitem.expanded ? '' : 'display: none'}">
                                ${this.getMenuHTML(options, _items, true, parentIndex.concat(f))}
                            </div>`
                    } else {
                        if (mitem.count != null) count_dsp += '<span>' + mitem.count + '</span>'
                        if (mitem.hotkey != null) count_dsp += '<span class="hotkey">' + mitem.hotkey + '</span>'
                    }
                    if (mitem.disabled === true) classes.push('w2ui-disabled')
                    if (mitem._noSearchInside === true) classes.push('w2ui-no-search-inside')
                    if (subMenu_dsp !== '') {
                        classes.push('has-sub-menu')
                        if (mitem.expanded) {
                            classes.push('expanded')
                        } else {
                            classes.push('collapsed')
                        }
                    }
                    menu_html += `
                        <div index="${index}" class="${classes.join(' ')}" style="${mitem.style ? mitem.style : ''}"
                            data-index="${f}" data-parents="${parentIndex.join('-')}">
                                <div style="width: ${(subMenu ? 20 : 0) + parseInt(mitem.indent ?? 0)}px"></div>
                                ${icon_dsp}
                                <div class="menu-text" colspan="${colspan}">${w2utils.lang(txt)}</div>
                                <div class="menu-extra">${count_dsp}</div>
                        </div>
                        ${subMenu_dsp}`
                    count++
                } else {
                    // horizontal line
                    let divText = (txt ?? '').replace(/^-+/g, '')
                    menu_html  += `
                        <div index="${index}" class="w2ui-menu-divider ${divText != '' ? 'has-text' : ''}">
                            <div class="line"></div>
                            ${divText ? `<div class="text">${divText}</div>` : ''}
                        </div>`
                }
            }
            items[f] = mitem
        })
        if (count === 0 && options.msgNoItems) {
            menu_html += `
                <div class="w2ui-no-items">
                    ${w2utils.lang(options.msgNoItems)}
                </div>`
        }
        menu_html += '</div>'
        return menu_html
    }
    // Refreshed only selected item highligh, used in keyboard navigation
    refreshIndex(name) {
        let overlay = Tooltip.active[name.replace(/[\s\.#]/g, '_')]
        if (!overlay) return
        if (!overlay.displayed) {
            this.show(overlay.name)
        }
        let view = query(overlay.box).find('.w2ui-overlay-body').get(0)
        let search = query(overlay.box).find('.w2ui-menu-search, .w2ui-menu-top').get(0)
        query(overlay.box).find('.w2ui-menu-item.w2ui-selected')
            .removeClass('w2ui-selected')
        let el = query(overlay.box).find(`.w2ui-menu-item[index="${overlay.selected}"]`)
            .addClass('w2ui-selected')
            .get(0)
        if (el) {
            if (el.offsetTop + el.clientHeight > view.clientHeight + view.scrollTop) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' })
            }
            if (el.offsetTop < view.scrollTop + (search ? search.clientHeight : 0)) {
                el.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'end' })
            }
        }
    }
    // show/hide searched items
    refreshSearch(name) {
        let overlay = Tooltip.active[name.replace(/[\s\.#]/g, '_')]
        if (!overlay) return
        if (!overlay.displayed) {
            this.show(overlay.name)
        }
        query(overlay.box).find('.w2ui-no-items').hide()
        query(overlay.box).find('.w2ui-menu-item, .w2ui-menu-divider').each(el => {
            let cur = this.getCurrent(name, el.getAttribute('index'))
            if (cur.item.hidden) {
                query(el).hide()
            } else {
                query(el).show()
            }
        })
        // hide empty menus
        query(overlay.box).find('.w2ui-sub-menu').each(sub => {
            let hasItems = query(sub).find('.w2ui-menu-item').get().some(el => {
                return el.style.display != 'none' ? true : false
            })
            if (!hasItems) {
                query(sub).parent().hide()
            } else {
                query(sub).parent().show()
            }
        })
        // show empty message
        if (overlay.tmp.searchCount == 0) {
            if (query(overlay.box).find('.w2ui-no-items').length == 0) {
                query(overlay.box).find('.w2ui-menu:not(.w2ui-sub-menu)').append(`
                    <div class="w2ui-no-items">
                        ${w2utils.lang(overlay.options.msgNoItems)}
                    </div>`)
            }
            query(overlay.box).find('.w2ui-no-items').show()
        }
    }
    /**
     * Loops through the items and markes item.hidden for those that need to be hidden.
     * Return the number of visible items.
     */
    applyFilter(name, items, search) {
        let count = 0
        let overlay = Tooltip.active[name.replace(/[\s\.#]/g, '_')]
        let options = overlay.options
        if (items == null) items = options.items
        if (search == null) {
            if (['INPUT', 'TEXTAREA'].includes(overlay.anchor.tagName)) {
                search = overlay.anchor.value
            } else {
                search = ''
            }
        }
        let selectedIds = options.selected.map(item => {
            return item?.id ?? item
        })
        items.forEach(item => {
            let prefix = ''
            let suffix = ''
            if (['is', 'begins', 'begins with'].indexOf(options.match) !== -1) prefix = '^'
            if (['is', 'ends', 'ends with'].indexOf(options.match) !== -1) suffix = '$'
            try {
                let re = new RegExp(prefix + search + suffix, 'i')
                if (re.test(item.text) || item.text === '...') {
                    item.hidden = false
                } else {
                    item.hidden = true
                }
            } catch (e) {}
            // do not show selected items
            if (selectedIds.includes(item.id)) {
                item.hidden = true
            }
            // search nested items
            if (Array.isArray(item.items) && item.items.length > 0) {
                delete item._noSearchInside
                let subCount = this.applyFilter(name, item.items, search)
                if (subCount > 0) {
                    count += subCount
                    if (item.hidden) item._noSearchInside = true
                    item.expanded = true
                    item.hidden = false
                }
            }
            if (item.hidden !== true) count++
        })
        overlay.tmp.activeChain = null
        return count
    }
    /**
     * Builds an array of item ids that sequencial in navigation with up/down keys.
     * Skips hidden and disabled items and goes into nested structures.
     */
    getActiveChain(name, items, parents = [], res = [], noSave) {
        let overlay = Tooltip.active[name.replace(/[\s\.#]/g, '_')]
        if (overlay.tmp.activeChain != null) {
            return overlay.tmp.activeChain
        }
        if (items == null) items = overlay.options.items
        items.forEach((item, ind) => {
            if (!item.hidden && !item.disabled && !item?.text.startsWith('--')) {
                res.push(parents.concat([ind]).join('-'))
                if (Array.isArray(item.items) && item.items.length > 0 && item.expanded) {
                    parents.push(ind)
                    this.getActiveChain(name, item.items, parents, res, true)
                    parents.pop()
                }
            }
        })
        if (noSave == null) {
            overlay.tmp.activeChain = res
        }
        return res
    }
    menuDown(overlay, event, index, parentIndex) {
        let options = overlay.options
        let items   = w2utils.normMenu(options.items)
        let icon    = query(event.delegate).find('.w2ui-icon')
        let menu    = query(event.target).closest('.w2ui-menu:not(.w2ui-sub-menu)')
        if (typeof parentIndex == 'string' && parentIndex !== '') {
            let ids = parentIndex.split('-')
            ids.forEach(id => {
                items = w2utils.normMenu(items[id].items)
            })
        }
        let item = items[index]
        if (item.disabled) {
            return
        }
        let uncheck = (items, parent) => {
            items.forEach((other, ind) => {
                if (other.id == item.id) return
                if (other.group === item.group && other.checked) {
                    menu
                        .find(`.w2ui-menu-item[index="${(parent ? parent + '-' : '') + ind}"] .w2ui-icon`)
                        .removeClass('w2ui-icon-check')
                        .addClass('w2ui-icon-empty')
                    items[ind].checked = false
                }
                if (Array.isArray(other.items)) {
                    uncheck(other.items, ind)
                }
            })
        }
        if ((options.type === 'check' || options.type === 'radio') && item.group !== false
                    && !query(event.target).hasClass('remove')
                    && !query(event.target).closest('.w2ui-menu-item').hasClass('has-sub-menu')) {
            item.checked = options.type == 'radio' ? true : !item.checked
            if (item.checked) {
                if (options.type === 'radio') {
                    query(event.target).closest('.w2ui-menu').find('.w2ui-icon')
                        .removeClass('w2ui-icon-check')
                        .addClass('w2ui-icon-empty')
                }
                if (options.type === 'check' && item.group != null) {
                    uncheck(options.items)
                }
                icon.removeClass('w2ui-icon-empty').addClass('w2ui-icon-check')
            } else if (options.type === 'check') {
                icon.removeClass('w2ui-icon-check').addClass('w2ui-icon-empty')
            }
        }
        // highlight record
        if (!query(event.target).hasClass('remove')) {
            menu.find('.w2ui-menu-item').removeClass('w2ui-selected')
            query(event.delegate).addClass('w2ui-selected')
        }
    }
    menuClick(overlay, event, index, parentIndex) {
        let options  = overlay.options
        let items    = w2utils.normMenu(options.items)
        let $item    = query(event.delegate).closest('.w2ui-menu-item')
        let keepOpen = options.hideOn.includes('select') ? false : true
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
            keepOpen = true
        }
        if (typeof parentIndex == 'string' && parentIndex !== '') {
            let ids = parentIndex.split('-')
            ids.forEach(id => {
                items = w2utils.normMenu(items[id].items)
            })
        }
        if (typeof items == 'function') {
            items = items({ overlay, index, parentIndex, event })
        }
        let item = items[index]
        if (item.disabled && !query(event.target).hasClass('remove')) {
            return
        }
        let edata
        if (query(event.target).hasClass('remove')) {
            edata = this.trigger('remove', { target: overlay.name,
                        overlay, item, index, parentIndex, el: $item[0] })
            if (edata.isCancelled === true) {
                return
            }
            keepOpen = !options.hideOn.includes('item-remove')
            $item.remove()
        } else if ($item.hasClass('has-sub-menu')) {
            edata = this.trigger('subMenu', { target: overlay.name, overlay, item, index, parentIndex, el: $item[0] })
            if (edata.isCancelled === true) {
                return
            }
            keepOpen = true
            if ($item.hasClass('expanded')) {
                item.expanded = false
                $item.removeClass('expanded').addClass('collapsed')
                query($item.get(0).nextElementSibling).hide()
                overlay.selected = $item.attr('index')
            } else {
                item.expanded = true
                $item.addClass('expanded').removeClass('collapsed')
                query($item.get(0).nextElementSibling).show()
                overlay.selected = $item.attr('index')
            }
        } else {
            edata = this.trigger('select', { target: overlay.name, overlay, item, index, parentIndex, keepOpen, el: $item[0] })
            if (edata.isCancelled === true) {
                return
            }
            overlay.selected = $item.attr('index')
            if (item.keepOpen != null) {
                keepOpen = item.keepOpen
            }
            if (['INPUT', 'TEXTAREA'].includes(overlay.anchor.tagName)) {
                overlay.anchor.dataset.selected = item.id
                overlay.anchor.dataset.selectedIndex = overlay.selected
            }
        }
        if (!keepOpen) {
            this.hide(overlay.name)
        }
        // if (['INPUT', 'TEXTAREA'].includes(overlay.anchor.tagName)) {
        //     overlay.anchor.focus()
        // }
        // event after
        edata.finish()
    }
    keyUp(overlay, event) {
        let options = overlay.options
        let search  = event.target.value
        let key     = event.keyCode
        let filter  = true
        let refreshIndex = false
        switch (key) {
            case 8: { // delete
                // if search empty and delete is clicked, do not filter nor show overlay
                if (search === '' && !overlay.displayed) filter = false
                break;
            }
            case 13: { // enter
                if (!overlay.displayed || !overlay.selected) return
                let { item, index, parents } = this.getCurrent(overlay.name)
                event.delegate = query(overlay.box).find('.w2ui-selected').get(0)
                // reset active chain for folders
                this.menuClick(overlay, event, index, parents)
                filter = false
                break
            }
            case 27: { // escape
                filter = false
                if (overlay.displayed) {
                    this.hide(overlay.name)
                } else {
                    // clear selected
                    let el = overlay.anchor
                    if (['INPUT', 'TEXTAREA'].includes(el.tagName)) {
                        el.value = ''
                        delete el.dataset.selected
                        delete el.dataset.selectedIndex
                    }
                }
                break
            }
            case 37: { // left
                if (!overlay.displayed) return
                let { item, index, parents } = this.getCurrent(overlay.name)
                // collapse parent if any
                if (parents) {
                    item    = options.items[parents]
                    index   = parseInt(parents)
                    parents = ''
                    refreshIndex = true
                }
                if (Array.isArray(item.items) && item.items.length > 0 && item.expanded) {
                    event.delegate = query(overlay.box).find(`.w2ui-menu-item[index="${index}"]`).get(0)
                    overlay.selected = index
                    this.menuClick(overlay, event, index, parents)
                }
                filter = false
                break
            }
            case 39: { // right
                if (!overlay.displayed) return
                let { item, index, parents } = this.getCurrent(overlay.name)
                if (Array.isArray(item.items) && item.items.length > 0 && !item.expanded) {
                    event.delegate = query(overlay.box).find('.w2ui-selected').get(0)
                    this.menuClick(overlay, event, index, parents)
                }
                filter = false
                break
            }
            case 38: { // up
                if (!overlay.displayed) {
                    break
                }
                let chain = this.getActiveChain(overlay.name)
                if (overlay.selected == null || overlay.selected?.length == 0) {
                    overlay.selected = chain[chain.length-1]
                } else {
                    let ind = chain.indexOf(overlay.selected)
                    // selected not in chain of items
                    if (ind == -1) {
                        overlay.selected = chain[chain.length-1]
                    }
                    // not first item
                    if (ind > 0) {
                        overlay.selected = chain[ind - 1]
                    }
                }
                filter = false
                refreshIndex = true
                event.preventDefault()
                break
            }
            case 40: { // down
                if (!overlay.displayed) {
                    break
                }
                let chain = this.getActiveChain(overlay.name)
                if (overlay.selected == null || overlay.selected?.length == 0) {
                    overlay.selected = chain[0]
                } else {
                    let ind = chain.indexOf(overlay.selected)
                    // selected not in chain of items
                    if (ind == -1) {
                        overlay.selected = chain[0]
                    }
                    // not the last item
                    if (ind < chain.length - 1) {
                        overlay.selected = chain[ind + 1]
                    }
                }
                filter = false
                refreshIndex = true
                event.preventDefault()
                break
            }
        }
        // filter
        if (filter && ((options.filter && event._searchType == 'filter')
                    || (options.search && event._searchType == 'search'))) {
            let count = this.applyFilter(overlay.name, options.items, search)
            overlay.tmp.searchCount = count
            overlay.tmp.search = search
            // if selected is not in searched items
            if (count === 0 || !this.getActiveChain(overlay.name).includes(overlay.selected)) {
                overlay.selected = null
            }
            this.refreshSearch(overlay.name)
        }
        if (refreshIndex) {
            this.refreshIndex(overlay.name)
        }
    }
}
class DateTooltip extends Tooltip {
    constructor() {
        super()
        let td = new Date()
        this.months = w2utils.settings.fullmonths
        this.smonths = w2utils.settings.shortmonths
        this.daysCount = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        this.today = td.getFullYear() + '/' + (Number(td.getMonth()) + 1) + '/' + td.getDate()
        this.days = w2utils.settings.fulldays.slice() // creates copy of the array
        this.sdays = w2utils.settings.shortdays.slice() // creates copy of the array
        if (w2utils.settings.weekStarts !== 'M') {
            this.days.unshift(this.days.pop())
            this.sdays.unshift(this.sdays.pop())
        }
        this.defaults = w2utils.extend({}, this.defaults, {
            position      : 'top|bottom',
            class         : 'w2ui-white w2ui-calendar',
            type          : 'date', // can be date/time/datetime
            format        : '',
            value         : '', // initial date (in w2utils.settings format)
            start         : null,
            end           : null,
            blockDates    : [], // array of blocked dates
            blockWeekdays : [], // blocked weekdays 0 - sunday, 1 - monday, etc
            colored       : {}, // ex: { '3/13/2022': 'bg-color|text-color' }
            arrowSize     : 12,
            autoResize    : false,
            anchorClass   : 'w2ui-focus',
            autoShowOn    : 'focus',
            hideOn        : ['doc-click', 'focus-change'],
            onSelect      : null
        })
    }
    attach(anchor, text) {
        let options
        if (arguments.length == 1 && anchor.anchor) {
            options = anchor
            anchor = options.anchor
        } else if (arguments.length === 2 && text != null && typeof text === 'object') {
            options = text
            options.anchor = anchor
        }
        let prevHideOn = options.hideOn
        options = w2utils.extend({}, this.defaults, options || {})
        if (prevHideOn) {
            options.hideOn = prevHideOn
        }
        if (!options.format) {
            let df = w2utils.settings.dateFormat
            let tf = w2utils.settings.timrFormat
            if (options.type == 'date') {
                options.format = df
            } else if (options.type == 'time') {
                options.format = tf
            } else {
                options.format = df + '|' + tf
            }
        }
        let cal = options.type == 'time' ? this.getHourHTML(options) : this.getMonthHTML(options)
        options.style += '; padding: 0;'
        options.html = cal.html
        let ret = super.attach(options)
        let overlay = ret.overlay
        Object.assign(overlay.tmp, cal)
        overlay.on('show.attach', event => {
            let overlay = event.detail.overlay
            let anchor  = overlay.anchor
            let options = overlay.options
            if (['INPUT', 'TEXTAREA'].includes(anchor.tagName) && !options.value && anchor.value) {
                overlay.tmp.initValue = anchor.value
            }
            delete overlay.newValue
            delete overlay.newDate
        })
        overlay.on('show:after.attach', event => {
            if (ret.overlay?.box) {
                this.initControls(ret.overlay)
            }
        })
        overlay.on('update:after.attach', event => {
            if (ret.overlay?.box) {
                this.initControls(ret.overlay)
            }
        })
        overlay.on('hide.attach', event => {
            let overlay = event.detail.overlay
            let anchor  = overlay.anchor
            if (overlay.newValue != null) {
                if (overlay.newDate) {
                    overlay.newValue = overlay.newDate + ' ' + overlay.newValue
                }
                if (['INPUT', 'TEXTAREA'].includes(anchor.tagName) && anchor.value != overlay.newValue) {
                    anchor.value = overlay.newValue
                }
                let edata = this.trigger('select', { date: overlay.newValue, target: overlay.name, overlay })
                if (edata.isCancelled === true) return
                // event after
                edata.finish()
            }
        })
        ret.select = (callback) => {
            overlay.on('select.attach', (event) => { callback(event) })
            return ret
        }
        return ret
    }
    initControls(overlay) {
        let options = overlay.options
        let moveMonth = (inc) => {
            let { month, year } = overlay.tmp
            month += inc
            if (month > 12) {
                month = 1
                year++
            }
            if (month < 1 ) {
                month = 12
                year--
            }
            let cal = this.getMonthHTML(options, month, year)
            Object.assign(overlay.tmp, cal)
            query(overlay.box).find('.w2ui-overlay-body').html(cal.html)
            this.initControls(overlay)
        }
        let checkJump = (event, dblclick) => {
            query(event.target).parent().find('.w2ui-jump-month, .w2ui-jump-year')
                .removeClass('selected')
            query(event.target).addClass('selected')
            let dt = new Date()
            let { jumpMonth, jumpYear } = overlay.tmp
            if (dblclick) {
                if (jumpYear == null) jumpYear = dt.getFullYear()
                if (jumpMonth == null) jumpMonth = dt.getMonth() + 1
            }
            if (jumpMonth && jumpYear) {
                let cal = this.getMonthHTML(options, jumpMonth, jumpYear)
                Object.assign(overlay.tmp, cal)
                query(overlay.box).find('.w2ui-overlay-body').html(cal.html)
                overlay.tmp.jump = false
                this.initControls(overlay)
            }
        }
        // events for next/prev buttons and title
        query(overlay.box).find('.w2ui-cal-title')
            .off('.calendar')
            // click on title
            .on('click.calendar', event => {
                Object.assign(overlay.tmp, { jumpYear: null, jumpMonth: null })
                if (overlay.tmp.jump) {
                    let { month, year } = overlay.tmp
                    let cal = this.getMonthHTML(options, month, year)
                    query(overlay.box).find('.w2ui-overlay-body').html(cal.html)
                    overlay.tmp.jump = false
                } else {
                    query(overlay.box).find('.w2ui-overlay-body .w2ui-cal-days')
                        .replace(this.getYearHTML())
                    let el = query(overlay.box).find(`[name="${overlay.tmp.year}"]`).get(0)
                    if (el) el.scrollIntoView(true)
                    overlay.tmp.jump = true
                }
                this.initControls(overlay)
                event.stopPropagation()
            })
            // prev button
            .find('.w2ui-cal-previous')
            .off('.calendar')
            .on('click.calendar', event => {
                moveMonth(-1)
                event.stopPropagation()
            })
            .parent()
            // next button
            .find('.w2ui-cal-next')
            .off('.calendar')
            .on('click.calendar', event => {
                moveMonth(1)
                event.stopPropagation()
            })
        // now button
        query(overlay.box).find('.w2ui-cal-now')
            .off('.calendar')
            .on('click.calendar', event => {
                if (options.type == 'datetime') {
                    if (overlay.newDate) {
                        overlay.newValue = w2utils.formatTime(new Date(), options.format.split('|')[1])
                    } else {
                        overlay.newValue = w2utils.formatDateTime(new Date(), options.format)
                    }
                } else if (options.type == 'date') {
                    overlay.newValue = w2utils.formatDate(new Date(), options.format)
                } else if (options.type == 'time') {
                    overlay.newValue = w2utils.formatTime(new Date(), options.format)
                }
                this.hide(overlay.name)
            })
        // events for dates
        query(overlay.box)
            .off('.calendar')
            .on('click.calendar', { delegate: '.w2ui-day.date' }, event => {
                if (options.type == 'datetime') {
                    overlay.newDate = query(event.target).attr('date')
                    query(overlay.box).find('.w2ui-overlay-body').html(this.getHourHTML(overlay.options).html)
                    this.initControls(overlay)
                } else {
                    overlay.newValue = query(event.target).attr('date')
                    this.hide(overlay.name)
                }
            })
            // click on month
            .on('click.calendar', { delegate: '.w2ui-jump-month' }, event => {
                overlay.tmp.jumpMonth = parseInt(query(event.target).attr('name'))
                checkJump(event)
            })
            // double click on month
            .on('dblclick.calendar', { delegate: '.w2ui-jump-month' }, event => {
                overlay.tmp.jumpMonth = parseInt(query(event.target).attr('name'))
                checkJump(event, true)
            })
            // click on year
            .on('click.calendar', { delegate: '.w2ui-jump-year' }, event => {
                overlay.tmp.jumpYear = parseInt(query(event.target).attr('name'))
                checkJump(event)
            })
            // dbl click on year
            .on('dblclick.calendar', { delegate: '.w2ui-jump-year' }, event => {
                overlay.tmp.jumpYear = parseInt(query(event.target).attr('name'))
                checkJump(event, true)
            })
            // click on hour
            .on('click.calendar', { delegate: '.w2ui-time.hour' }, event => {
                let hour = query(event.target).attr('hour');
                let min  = this.str2min(options.value) % 60
                if (overlay.tmp.initValue && !options.value) {
                    min = this.str2min(overlay.tmp.initValue) % 60
                }
                if (options.noMinutes) {
                    overlay.newValue = this.min2str(hour * 60, options.format);
                    this.hide(overlay.name)
                } else {
                    overlay.newValue = hour + ':' + min
                    let html = this.getMinHTML(hour, options).html
                    query(overlay.box).find('.w2ui-overlay-body').html(html)
                    this.initControls(overlay)
                }
            })
            // click on minute
            .on('click.calendar', { delegate: '.w2ui-time.min' }, event => {
                let hour = Math.floor(this.str2min(overlay.newValue) / 60)
                let time = (hour * 60) + parseInt(query(event.target).attr('min'));
                overlay.newValue = this.min2str(time, options.format);
                this.hide(overlay.name)
            })
    }
    getMonthHTML(options, month, year) {
        let td = new Date()
        let dayLengthMil = 1000 * 60 * 60 * 24
        let selected = options.type === 'datetime'
            ? w2utils.isDateTime(options.value, options.format, true)
            : w2utils.isDate(options.value, options.format, true)
        let selected_dsp = w2utils.formatDate(selected)
        // normalize date
        if (month == null || year == null) {
            year  = selected ? selected.getFullYear() : td.getFullYear()
            month = selected ? selected.getMonth() + 1 : td.getMonth() + 1
        }
        if (month > 12) { month -= 12; year++ }
        if (month < 1 || month === 0) { month += 12; year-- }
        if (year/4 == Math.floor(year/4)) { this.daysCount[1] = 29 } else { this.daysCount[1] = 28 }
        options.current = month + '/' + year
        // start with the required date
        td = new Date(year, month-1, 1)
        let weekDay = td.getDay()
        let weekDays = ''
        let st = w2utils.settings.weekStarts
        for (let i = 0; i < this.sdays.length; i++) {
            let isSat = (st == 'M' && i == 5) || (st != 'M' && i == 6) ? true : false
            let isSun = (st == 'M' && i == 6) || (st != 'M' && i == 0) ? true : false
            weekDays += `<div class="w2ui-day weekday ${isSat ? 'sunday' : ''} ${isSun ? 'saturday' : ''}">${this.sdays[i]}</div>`
        }
        let html = `
            <div class="w2ui-cal-title">
                <div class="w2ui-cal-previous">
                    <div></div>
                </div>
                <div class="w2ui-cal-next">
                    <div></div>
                </div>
                ${this.months[month-1]}, ${year}
                <span class="arrow-down"></span>
            </div>
            <div class="w2ui-cal-days">
                ${weekDays}
        `
        let DT = new Date(`${year}/${month}/1`) // first of month
        let weekday = DT.getDay()
        if (w2utils.settings.weekStarts == 'M') weekDay--
        if (weekday > 0) {
            DT = new Date(DT.getTime() - (weekDay * dayLengthMil))
        }
        for (let ci = 0; ci < 42; ci++) {
            let className = []
            let dt = `${DT.getFullYear()}/${DT.getMonth()+1}/${DT.getDate()}`
            if (DT.getDay() === 6) className.push('saturday')
            if (DT.getDay() === 0) className.push('sunday')
            if (DT.getMonth() + 1 !== month) className.push('outside')
            if (dt == this.today) className.push('today')
            let dspDay = DT.getDate()
            let col    = ''
            let bgcol  = ''
            let tmp_dt, tmp_dt_fmt
            if (options.type === 'datetime') {
                tmp_dt     = w2utils.formatDateTime(dt, options.format)
                tmp_dt_fmt = w2utils.formatDate(dt, w2utils.settings.dateFormat)
            } else {
                tmp_dt     = w2utils.formatDate(dt, options.format)
                tmp_dt_fmt = tmp_dt
            }
            if (options.colored && options.colored[tmp_dt_fmt] !== undefined) { // if there is predefined colors for dates
                let tmp = options.colored[tmp_dt_fmt].split('|')
                bgcol   = 'background-color: ' + tmp[0] + ';'
                col     = 'color: ' + tmp[1] + ';'
            }
            html += `<div class="w2ui-day ${this.inRange(tmp_dt, options, true)
                            ? 'date ' + (tmp_dt_fmt == selected_dsp ? 'selected' : '')
                            : 'blocked'
                        } ${className.join(' ')}"
                       style="${col + bgcol}" date="${tmp_dt_fmt}" data-date="${DT.getTime()}">
                            ${dspDay}
                    </div>`
            DT = new Date(DT.getTime() + dayLengthMil)
        }
        html += '</div>'
        if (options.btnNow) {
            let label = w2utils.lang('Today' + (options.type == 'datetime' ? ' & Now' : ''))
            html += `<div class="w2ui-cal-now">${label}</div>`
        }
        return { html, month, year }
    }
    getYearHTML() {
        let mhtml = ''
        let yhtml = ''
        for (let m = 0; m < this.months.length; m++) {
            mhtml += `<div class="w2ui-jump-month" name="${m+1}">${this.smonths[m]}</div>`
        }
        for (let y = w2utils.settings.dateStartYear; y <= w2utils.settings.dateEndYear; y++) {
            yhtml += `<div class="w2ui-jump-year" name="${y}">${y}</div>`
        }
        return `<div class="w2ui-cal-jump">
            <div id="w2ui-jump-month">${mhtml}</div>
            <div id="w2ui-jump-year">${yhtml}</div>
        </div>`
    }
    getHourHTML(options) {
        options = options ?? {}
        if (!options.format) options.format = w2utils.settings.timeFormat
        let h24 = (options.format.indexOf('h24') > -1)
        let value = options.value ? options.value : (options.anchor ? options.anchor.value : '')
        let tmp = []
        for (let a = 0; a < 24; a++) {
            let time = (a >= 12 && !h24 ? a - 12 : a) + ':00' + (!h24 ? (a < 12 ? ' am' : ' pm') : '')
            if (a == 12 && !h24) time = '12:00 pm'
            if (!tmp[Math.floor(a/8)]) tmp[Math.floor(a/8)] = ''
            let tm1 = this.min2str(this.str2min(time))
            let tm2 = this.min2str(this.str2min(time) + 59)
            if (options.type === 'datetime') {
                let dt = w2utils.isDateTime(value, options.format, true)
                let fm = options.format.split('|')[0].trim()
                tm1    = w2utils.formatDate(dt, fm) + ' ' + tm1
                tm2    = w2utils.formatDate(dt, fm) + ' ' + tm2
            }
            let valid = this.inRange(tm1, options) || this.inRange(tm2, options)
            tmp[Math.floor(a/8)] += `<span hour="${a}"
                class="hour ${valid ? 'w2ui-time ' : 'w2ui-blocked'}">${time}</span>`
        }
        let html = `<div class="w2ui-calendar">
            <div class="w2ui-time-title">${w2utils.lang('Select Hour')}</div>
            <div class="w2ui-cal-time">
                <div class="w2ui-cal-column">${tmp[0]}</div>
                <div class="w2ui-cal-column">${tmp[1]}</div>
                <div class="w2ui-cal-column">${tmp[2]}</div>
            </div>
            ${options.btnNow ? `<div class="w2ui-cal-now">${w2utils.lang('Now')}</div>` : '' }
        </div>`
        return { html }
    }
    getMinHTML(hour, options) {
        if (hour == null) hour = 0
        options = options ?? {}
        if (!options.format) options.format = w2utils.settings.timeFormat
        let h24 = (options.format.indexOf('h24') > -1)
        let value = options.value ? options.value : (options.anchor ? options.anchor.value : '')
        let tmp = []
        for (let a = 0; a < 60; a += 5) {
            let time = (hour > 12 && !h24 ? hour - 12 : hour) + ':' + (a < 10 ? 0 : '') + a + ' ' + (!h24 ? (hour < 12 ? 'am' : 'pm') : '')
            let tm   = time
            let ind  = a < 20 ? 0 : (a < 40 ? 1 : 2)
            if (!tmp[ind]) tmp[ind] = ''
            if (options.type === 'datetime') {
                let dt = w2utils.isDateTime(value, options.format, true)
                let fm = options.format.split('|')[0].trim()
                tm = w2utils.formatDate(dt, fm) + ' ' + tm
            }
            tmp[ind] += `<span min="${a}" class="min ${(this.inRange(tm, options) ? 'w2ui-time ' : 'w2ui-blocked')}">${time}</span>`
        }
        let html = `<div class="w2ui-calendar">
            <div class="w2ui-time-title">${w2utils.lang('Select Minute')}</div>
            <div class="w2ui-cal-time">
                <div class="w2ui-cal-column">${tmp[0]}</div>
                <div class="w2ui-cal-column">${tmp[1]}</div>
                <div class="w2ui-cal-column">${tmp[2]}</div>
            </div>
            ${options.btnNow ? `<div class="w2ui-cal-now">${w2utils.lang('Now')}</div>` : '' }
        </div>`
        return { html }
    }
    // checks if date is in range (loost at start, end, blockDates, blockWeekdays)
    inRange(str, options, dateOnly) {
        let inRange = false
        if (options.type === 'date') {
            let dt = w2utils.isDate(str, options.format, true)
            if (dt) {
                // enable range
                if (options.start || options.end) {
                    let st      = (typeof options.start === 'string' ? options.start : query(options.start).val())
                    let en      = (typeof options.end === 'string' ? options.end : query(options.end).val())
                    let start   = w2utils.isDate(st, options.format, true)
                    let end     = w2utils.isDate(en, options.format, true)
                    let current = new Date(dt)
                    if (!start) start = current
                    if (!end) end = current
                    if (current >= start && current <= end) inRange = true
                } else {
                    inRange = true
                }
                // block predefined dates
                if (Array.isArray(options.blockDates) && options.blockDates.includes(str)) inRange = false
                // block weekdays
                if (Array.isArray(options.blockWeekdays) && options.blockWeekdays.includes(dt.getDay())) inRange = false
            }
        } else if (options.type === 'time') {
            if (options.start || options.end) {
                let tm  = this.str2min(str)
                let tm1 = this.str2min(options.start)
                let tm2 = this.str2min(options.end)
                if (!tm1) tm1 = tm
                if (!tm2) tm2 = tm
                if (tm >= tm1 && tm <= tm2) inRange = true
            } else {
                inRange = true
            }
        } else if (options.type === 'datetime') {
            let dt = w2utils.isDateTime(str, options.format, true)
            if (dt) {
                let format = options.format.split('|').map(format => format.trim())
                if (dateOnly) {
                    let date = w2utils.formatDate(str, format[0])
                    let opts = w2utils.extend({}, options, { type: 'date', format: format[0] })
                    if (this.inRange(date, opts)) inRange = true
                } else {
                    let time = w2utils.formatTime(str, format[1])
                    let opts =  { type: 'time', format: format[1], start: options.startTime, end: options.endTime }
                    if (this.inRange(time, opts)) inRange = true
                }
            }
        }
        return inRange
    }
    // converts time into number of minutes since midnight -- '11:50am' => 710
    str2min(str) {
        if (typeof str !== 'string') return null
        let tmp = str.split(':')
        if (tmp.length === 2) {
            tmp[0] = parseInt(tmp[0])
            tmp[1] = parseInt(tmp[1])
            if (str.indexOf('pm') !== -1 && tmp[0] !== 12) tmp[0] += 12
            if (str.includes('am') && tmp[0] == 12) tmp[0] = 0 // 12:00am - is midnight
        } else {
            return null
        }
        return tmp[0] * 60 + tmp[1]
    }
    // converts minutes since midnight into time str -- 710 => '11:50am'
    min2str(time, format) {
        let ret = ''
        if (time >= 24 * 60) time = time % (24 * 60)
        if (time < 0) time = 24 * 60 + time
        let hour = Math.floor(time/60)
        let min = ((time % 60) < 10 ? '0' : '') + (time % 60)
        if (!format) { format = w2utils.settings.timeFormat}
        if (format.indexOf('h24') !== -1) {
            ret = hour + ':' + min
        } else {
            ret = (hour <= 12 ? hour : hour - 12) + ':' + min + ' ' + (hour >= 12 ? 'pm' : 'am')
        }
        return ret
    }
}
let w2tooltip = new Tooltip()
let w2menu    = new MenuTooltip()
let w2color   = new ColorTooltip()
let w2date    = new DateTooltip()

/*
// pull records from remote source for w2menu
clearCache() {
    let options          = this.options
    options.items        = []
    this.tmp.xhr_loading = false
    this.tmp.xhr_search  = ''
    this.tmp.xhr_total   = -1
}
request(interval) {
    let obj     = this
    let options = this.options
    let search  = $(obj.el).val() || ''
    // if no url - do nothing
    if (!options.url) return
    // --
    if (obj.type === 'enum') {
        let tmp = $(obj.helpers.multi).find('input')
        if (tmp.length === 0) search = ''; else search = tmp.val()
    }
    if (obj.type === 'list') {
        let tmp = $(obj.helpers.focus).find('input')
        if (tmp.length === 0) search = ''; else search = tmp.val()
    }
    if (options.minLength !== 0 && search.length < options.minLength) {
        options.items = [] // need to empty the list
        this.updateOverlay()
        return
    }
    if (interval == null) interval = options.interval
    if (obj.tmp.xhr_search == null) obj.tmp.xhr_search = ''
    if (obj.tmp.xhr_total == null) obj.tmp.xhr_total = -1
    // check if need to search
    if (options.url && $(obj.el).prop('readonly') !== true && $(obj.el).prop('disabled') !== true && (
        (options.items.length === 0 && obj.tmp.xhr_total !== 0) ||
            (obj.tmp.xhr_total == options.cacheMax && search.length > obj.tmp.xhr_search.length) ||
            (search.length >= obj.tmp.xhr_search.length && search.substr(0, obj.tmp.xhr_search.length) !== obj.tmp.xhr_search) ||
            (search.length < obj.tmp.xhr_search.length)
    )) {
        // empty list
        if (obj.tmp.xhr) try { obj.tmp.xhr.abort() } catch (e) {}
        obj.tmp.xhr_loading = true
        obj.search()
        // timeout
        clearTimeout(obj.tmp.timeout)
        obj.tmp.timeout = setTimeout(() => {
            // trigger event
            let url      = options.url
            let postData = {
                search : search,
                max    : options.cacheMax
            }
            $.extend(postData, options.postData)
            let edata = obj.trigger({ phase: 'before', type: 'request', search: search, target: obj.el, url: url, postData: postData })
            if (edata.isCancelled === true) return
            url             = edata.url
            postData        = edata.postData
            let ajaxOptions = {
                type     : 'GET',
                url      : url,
                data     : postData,
                dataType : 'JSON' // expected from server
            }
            if (options.method) ajaxOptions.type = options.method
            if (w2utils.settings.dataType === 'JSON') {
                ajaxOptions.type        = 'POST'
                ajaxOptions.data        = JSON.stringify(ajaxOptions.data)
                ajaxOptions.contentType = 'application/json'
            }
            if (w2utils.settings.dataType === 'HTTPJSON') {
                ajaxOptions.data = { request: JSON.stringify(ajaxOptions.data) }
            }
            if (w2utils.settings.dataType === 'RESTFULLJSON') {
                ajaxOptions.data = JSON.stringify(ajaxOptions.data)
                ajaxOptions.contentType = 'application/json'
            }
            if (options.method != null) ajaxOptions.type = options.method
            obj.tmp.xhr = $.ajax(ajaxOptions)
                .done((data, status, xhr) => {
                    // trigger event
                    let edata2 = obj.trigger({ phase: 'before', type: 'load', target: obj.el, search: postData.search, data: data, xhr: xhr })
                    if (edata2.isCancelled === true) return
                    // default behavior
                    data = edata2.data
                    if (typeof data === 'string') data = JSON.parse(data)
                    // if server just returns array
                    if (Array.isArray(data)) {
                        data = { records: data }
                    }
                    // needed for backward compatibility
                    if (data.records == null && data.items != null) {
                        data.records = data.items
                        delete data.items
                    }
                    // handles Golang marshal of empty arrays to null
                    if (data.status == 'success' && data.records == null) {
                        data.records = []
                    }
                    if (!Array.isArray(data.records)) {
                        console.error('ERROR: server did not return proper data structure', '\n',
                            ' - it should return', { status: 'success', records: [{ id: 1, text: 'item' }] }, '\n',
                            ' - or just an array ', [{ id: 1, text: 'item' }], '\n',
                            ' - actual response', typeof data === 'object' ? data : xhr.responseText)
                        return
                    }
                    // remove all extra items if more then needed for cache
                    if (data.records.length > options.cacheMax) data.records.splice(options.cacheMax, 100000)
                    // map id and text
                    if (options.recId == null && options.recid != null) options.recId = options.recid // since lower-case recid is used in grid
                    if (options.recId || options.recText) {
                        data.records.forEach((item) => {
                            if (typeof options.recId === 'string') item.id = item[options.recId]
                            if (typeof options.recId === 'function') item.id = options.recId(item)
                            if (typeof options.recText === 'string') item.text = item[options.recText]
                            if (typeof options.recText === 'function') item.text = options.recText(item)
                        })
                    }
                    // remember stats
                    obj.tmp.xhr_loading = false
                    obj.tmp.xhr_search  = search
                    obj.tmp.xhr_total   = data.records.length
                    obj.tmp.lastError   = ''
                    options.items       = w2utils.normMenu(data.records)
                    if (search === '' && data.records.length === 0) obj.tmp.emptySet = true; else obj.tmp.emptySet = false
                    // preset item
                    let find_selected = $(obj.el).data('find_selected')
                    if (find_selected) {
                        let sel
                        if (Array.isArray(find_selected)) {
                            sel = []
                            find_selected.forEach((find) => {
                                let isFound = false
                                options.items.forEach((item) => {
                                    if (item.id == find || (find && find.id == item.id)) {
                                        sel.push($.extend(true, {}, item))
                                        isFound = true
                                    }
                                })
                                if (!isFound) sel.push(find)
                            })
                        } else {
                            sel = find_selected
                            options.items.forEach((item) => {
                                if (item.id == find_selected || (find_selected && find_selected.id == item.id)) {
                                    sel = item
                                }
                            })
                        }
                        $(obj.el).data('selected', sel).removeData('find_selected').trigger('input').trigger('change')
                    }
                    obj.search()
                    // event after
                    obj.trigger($.extend(edata2, { phase: 'after' }))
                })
                .fail((xhr, status, error) => {
                    // trigger event
                    let errorObj = { status: status, error: error, rawResponseText: xhr.responseText }
                    let edata2   = obj.trigger({ phase: 'before', type: 'error', target: obj.el, search: search, error: errorObj, xhr: xhr })
                    if (edata2.isCancelled === true) return
                    // default behavior
                    if (status !== 'abort') {
                        let data
                        try { data = JSON.parse(xhr.responseText) } catch (e) {}
                        console.error('ERROR: server did not return proper data structure', '\n',
                            ' - it should return', { status: 'success', records: [{ id: 1, text: 'item' }] }, '\n',
                            ' - or just an array ', [{ id: 1, text: 'item' }], '\n',
                            ' - actual response', typeof data === 'object' ? data : xhr.responseText)
                    }
                    // reset stats
                    obj.tmp.xhr_loading = false
                    obj.tmp.xhr_search  = search
                    obj.tmp.xhr_total   = 0
                    obj.tmp.emptySet    = true
                    obj.tmp.lastError   = (edata2.error || 'Server communication failed')
                    options.items       = []
                    obj.clearCache()
                    obj.search()
                    obj.updateOverlay(false)
                    // event after
                    obj.trigger($.extend(edata2, { phase: 'after' }))
                })
            // event after
            obj.trigger($.extend(edata, { phase: 'after' }))
        }, interval)
    }
}
search() {
    let obj      = this
    let options  = this.options
    let search   = $(obj.el).val()
    let target   = obj.el
    let ids      = []
    let selected = $(obj.el).data('selected')
    if (obj.type === 'enum') {
        target = $(obj.helpers.multi).find('input')
        search = target.val()
        for (let s in selected) { if (selected[s]) ids.push(selected[s].id) }
    }
    else if (obj.type === 'list') {
        target = $(obj.helpers.focus).find('input')
        search = target.val()
        for (let s in selected) { if (selected[s]) ids.push(selected[s].id) }
    }
    let items = options.items
    if (obj.tmp.xhr_loading !== true) {
        let shown = 0
        for (let i = 0; i < items.length; i++) {
            let item = items[i]
            if (options.compare != null) {
                if (typeof options.compare === 'function') {
                    item.hidden = (options.compare.call(this, item, search) === false ? true : false)
                }
            } else {
                let prefix = ''
                let suffix = ''
                if (['is', 'begins'].indexOf(options.match) !== -1) prefix = '^'
                if (['is', 'ends'].indexOf(options.match) !== -1) suffix = '$'
                try {
                    let re = new RegExp(prefix + search + suffix, 'i')
                    if (re.test(item.text) || item.text === '...') item.hidden = false; else item.hidden = true
                } catch (e) {}
            }
            if (options.filter === false) item.hidden = false
            // do not show selected items
            if (obj.type === 'enum' && $.inArray(item.id, ids) !== -1) item.hidden = true
            if (item.hidden !== true) { shown++; delete item.hidden }
        }
        // preselect first item
        options.index = []
        options.spinner = false
        setTimeout(() => {
            if (options.markSearch && $('#w2ui-overlay .no-matches').length == 0) { // do not highlight when no items
                $('#w2ui-overlay').w2marker(search)
            }
        }, 1)
    } else {
        items.splice(0, options.cacheMax)
        options.spinner = true
    }
    // only update overlay when it is displayed already
    if ($('#w2ui-overlay').length > 0) {
        obj.updateOverlay()
    }
}
*/
/**
 * Part of w2ui 2.0 library
 *  - Dependencies: mQuery, w2utils, w2base, w2tooltip, w2color, w2menu
 *
 * == TODO ==
 *  - tab navigation (index state)
 *  - vertical toolbar
 *  - w2menu on second click of tb button should hide
 *  - button display groups for each show/hide, possibly add state: { single: t/f, multiple: t/f, type: 'font' }
 *
 * == 2.0 changes
 *  - CSP - fixed inline events
 *  - removed jQuery dependency
 *  - item.icon - can be class or <custom-icon-component> or <svg>
 *  - new w2tooltips and w2menu
 *  - scroll returns promise
 */

class w2toolbar extends w2base {
    constructor(options) {
        super(options.name)
        this.box           = null // DOM Element that holds the element
        this.name          = null // unique name for w2ui
        this.routeData     = {} // data for dynamic routes
        this.items         = []
        this.right         = '' // HTML text on the right of toolbar
        this.tooltip       = 'top|left'// can be top, bottom, left, right
        this.onClick       = null
        this.onRender      = null
        this.onRefresh     = null
        this.onResize      = null
        this.onDestroy     = null
        this.item_template = {
            id: null, // command to be sent to all event handlers
            type: 'button', // button, check, radio, drop, menu, menu-radio, menu-check, break, html, spacer
            text: null,
            html: '',
            tooltip: null,  // w2toolbar.tooltip should be
            count: null,
            hidden: false,
            disabled: false,
            checked: false, // used for radio buttons
            icon: null,
            route: null,    // if not null, it is route to go
            arrow: null,    // arrow down for drop/menu types
            style: null,    // extra css style for caption
            group: null,    // used for radio buttons
            items: null,    // for type menu* it is an array of items in the menu
            selected: null, // used for menu-check, menu-radio
            color: null,    // color value - used in color pickers
            overlay: {      // additional options for overlay
                anchorClass: ''
            },
            onClick: null,
            onRefresh: null
        }
        this.last = {
            badge: {}
        }
        // mix in options, w/o items
        let items = options.items
        delete options.items
        Object.assign(this, options)
        // add item via method to makes sure item_template is applied
        if (Array.isArray(items)) this.add(items)
        // need to reassign back to keep it in config
        options.items = items
    }
    add(items) {
        this.insert(null, items)
    }
    insert(id, items) {
        if (!Array.isArray(items)) items = [items]
        items.forEach((item, idx, arr) => {
            if(typeof item === 'string') {
                item = arr[idx] = { id: item, text: item }
            }
            // checks
            let valid = ['button', 'check', 'radio', 'drop', 'menu', 'menu-radio', 'menu-check', 'color', 'text-color', 'html',
                'break', 'spacer', 'new-line']
            if (!valid.includes(String(item.type))) {
                console.log('ERROR: The parameter "type" should be one of the following:', valid, `, but ${item.type} is supplied.`, item)
                return
            }
            if (item.id == null && !['break', 'spacer', 'new-line'].includes(item.type)) {
                console.log('ERROR: The parameter "id" is required but not supplied.', item)
                return
            }
            if (item.type == null) {
                console.log('ERROR: The parameter "type" is required but not supplied.', item)
                return
            }
            if (!w2utils.checkUniqueId(item.id, this.items, 'toolbar', this.name)) return
            // add item
            let newItem = w2utils.extend({}, this.item_template, item)
            if (newItem.type == 'menu-check') {
                if (!Array.isArray(newItem.selected)) newItem.selected = []
                if (Array.isArray(newItem.items)) {
                    newItem.items.forEach(it => {
                        if(typeof it === 'string') {
                            it = arr[idx] = { id: it, text: it }
                        }
                        if (it.checked && !newItem.selected.includes(it.id)) newItem.selected.push(it.id)
                        if (!it.checked && newItem.selected.includes(it.id)) it.checked = true
                        if (it.checked == null) it.checked = false
                    })
                }
            } else if (newItem.type == 'menu-radio') {
                if (Array.isArray(newItem.items)) {
                    newItem.items.forEach((it, idx, arr) => {
                        if(typeof it === 'string') {
                            it = arr[idx] = { id: it, text: it }
                        }
                        if (it.checked && newItem.selected == null) newItem.selected = it.id; else it.checked = false
                        if (!it.checked && newItem.selected == it.id) it.checked = true
                        if (it.checked == null) it.checked = false
                    })
                }
            }
            if (id == null) {
                this.items.push(newItem)
            } else {
                let middle = this.get(id, true)
                this.items = this.items.slice(0, middle).concat([newItem], this.items.slice(middle))
            }
            newItem.line = newItem.line || 1
            this.refresh(newItem.id)
        })
        this.resize()
    }
    remove() {
        let effected = 0
        Array.from(arguments).forEach(item => {
            let it = this.get(item)
            if (!it || String(item).indexOf(':') != -1) return
            effected++
            // remove from screen
            query(this.box).find('#tb_'+ this.name +'_item_'+ w2utils.escapeId(it.id)).remove()
            // remove from array
            let ind = this.get(it.id, true)
            if (ind != null) this.items.splice(ind, 1)
        })
        this.resize()
        return effected
    }
    set(id, newOptions) {
        let item = this.get(id)
        if (item == null) return false
        Object.assign(item, newOptions)
        this.refresh(String(id).split(':')[0])
        return true
    }
    get(id, returnIndex) {
        if (arguments.length === 0) {
            let all = []
            for (let i1 = 0; i1 < this.items.length; i1++) if (this.items[i1].id != null) all.push(this.items[i1].id)
            return all
        }
        let tmp = String(id).split(':')
        for (let i2 = 0; i2 < this.items.length; i2++) {
            let it = this.items[i2]
            // find a menu item
            if (['menu', 'menu-radio', 'menu-check'].includes(it.type) && tmp.length == 2 && it.id == tmp[0]) {
                let subItems = it.items
                if (typeof subItems == 'function') subItems = subItems(this)
                for (let i = 0; i < subItems.length; i++) {
                    let item = subItems[i]
                    if (item.id == tmp[1] || (item.id == null && item.text == tmp[1])) {
                        if (returnIndex == true) return i; else return item
                    }
                    if (Array.isArray(item.items)) {
                        for (let j = 0; j < item.items.length; j++) {
                            if (item.items[j].id == tmp[1] || (item.items[j].id == null && item.items[j].text == tmp[1])) {
                                if (returnIndex == true) return i; else return item.items[j]
                            }
                        }
                    }
                }
            } else if (it.id == tmp[0]) {
                if (returnIndex == true) return i2; else return it
            }
        }
        return null
    }
    setCount(id, count, className, style) {
        let btn = query(this.box).find(`#tb_${this.name}_item_${w2utils.escapeId(id)} .w2ui-tb-count > span`)
        if (btn.length > 0) {
            btn.removeClass()
                .addClass(className || '')
                .text(count)
                .get(0).style.cssText = style || ''
            this.last.badge[id] = {
                className: className || '',
                style: style || ''
            }
            let item = this.get(id)
            item.count = count
        } else {
            this.set(id, { count: count })
            this.setCount(...arguments) // to update styles
        }
    }
    show() {
        let effected = []
        Array.from(arguments).forEach(item => {
            let it = this.get(item)
            if (!it) return
            it.hidden = false
            effected.push(String(item).split(':')[0])
        })
        setTimeout(() => { effected.forEach(it => { this.refresh(it); this.resize() }) }, 15) // needs timeout
        return effected
    }
    hide() {
        let effected = []
        Array.from(arguments).forEach(item => {
            let it = this.get(item)
            if (!it) return
            it.hidden = true
            effected.push(String(item).split(':')[0])
        })
        setTimeout(() => { effected.forEach(it => { this.refresh(it); this.tooltipHide(it); this.resize() }) }, 15) // needs timeout
        return effected
    }
    enable() {
        let effected = []
        Array.from(arguments).forEach(item => {
            let it = this.get(item)
            if (!it) return
            it.disabled = false
            effected.push(String(item).split(':')[0])
        })
        setTimeout(() => { effected.forEach(it => { this.refresh(it) }) }, 15) // needs timeout
        return effected
    }
    disable() {
        let effected = []
        Array.from(arguments).forEach(item => {
            let it = this.get(item)
            if (!it) return
            it.disabled = true
            effected.push(String(item).split(':')[0])
        })
        setTimeout(() => { effected.forEach(it => { this.refresh(it); this.tooltipHide(it) }) }, 15) // needs timeout
        return effected
    }
    check() {
        let effected = []
        Array.from(arguments).forEach(item => {
            let it = this.get(item)
            if (!it || String(item).indexOf(':') != -1) return
            it.checked = true
            effected.push(String(item).split(':')[0])
        })
        setTimeout(() => { effected.forEach(it => { this.refresh(it) }) }, 15) // needs timeout
        return effected
    }
    uncheck() {
        let effected = []
        Array.from(arguments).forEach(item => {
            let it = this.get(item)
            if (!it || String(item).indexOf(':') != -1) return
            // remove overlay
            if (['menu', 'menu-radio', 'menu-check', 'drop', 'color', 'text-color'].includes(it.type) && it.checked) {
                w2tooltip.hide(this.name + '-drop')
            }
            it.checked = false
            effected.push(String(item).split(':')[0])
        })
        setTimeout(() => { effected.forEach(it => { this.refresh(it) }) }, 15) // needs timeout
        return effected
    }
    click(id, event) {
        let obj = this
        // click on menu items
        let tmp   = String(id).split(':')
        let it    = this.get(tmp[0])
        let items = (it && it.items ? w2utils.normMenu.call(this, it.items, it) : [])
        if (tmp.length > 1) {
            let subItem = this.get(id)
            if (subItem && !subItem.disabled) {
                obj.menuClick({ name: obj.name, item: it, subItem: subItem, originalEvent: event })
            }
            return
        }
        if (it && !it.disabled) {
            // event before
            let edata = this.trigger('click', {
                target: (id != null ? id : this.name),
                item: it, object: it, originalEvent: event
            })
            if (edata.isCancelled === true) return
            // read items again, they might have been changed in the click event handler
            items = (it && it.items ? w2utils.normMenu.call(this, it.items, it) : [])
            let btn = '#tb_'+ this.name +'_item_'+ w2utils.escapeId(it.id)
            query(this.box).find(btn).removeClass('down') // need to re-query at the moment -- as well as elsewhere in this function
            if (it.type == 'radio') {
                for (let i = 0; i < this.items.length; i++) {
                    let itt = this.items[i]
                    if (itt == null || itt.id == it.id || itt.type !== 'radio') continue
                    if (itt.group == it.group && itt.checked) {
                        itt.checked = false
                        this.refresh(itt.id)
                    }
                }
                it.checked = true
                query(this.box).find(btn).addClass('checked')
            }
            if (['menu', 'menu-radio', 'menu-check', 'drop', 'color', 'text-color'].includes(it.type)) {
                obj.tooltipHide(id)
                if (it.checked) {
                    w2tooltip.hide(this.name + '-drop')
                    // uncheck
                    it.checked = false
                    obj.refresh(it.id)
                } else {
                    // timeout is needed to make sure previous overlay hides
                    setTimeout(() => {
                        let hideDrop = (id, btn) => {
                            return function () {
                                let item = obj.get(id)
                                item.checked = false
                                query(obj.box).find(btn).removeClass('checked')
                            }
                        }
                        let el = query(obj.box).find('#tb_'+ obj.name +'_item_'+ w2utils.escapeId(it.id))
                        if (!w2utils.isPlainObject(it.overlay)) it.overlay = {}
                        if (it.type == 'drop') {
                            w2tooltip.show(w2utils.extend({
                                html: it.html,
                                class: 'w2ui-white',
                                hideOn: ['doc-click']
                            }, it.overlay, {
                                anchor: el[0],
                                name: this.name + '-drop',
                                data: { item: it, btn }
                            }))
                            .hide(hideDrop(it.id, btn))
                        }
                        if (['menu', 'menu-radio', 'menu-check'].includes(it.type)) {
                            let menuType = 'normal'
                            if (it.type == 'menu-radio') {
                                menuType = 'radio'
                                items.forEach((item) => {
                                    if (it.selected == item.id) item.checked = true; else item.checked = false
                                })
                            }
                            if (it.type == 'menu-check') {
                                menuType = 'check'
                                items.forEach((item) => {
                                    if (Array.isArray(it.selected) && it.selected.includes(item.id)) item.checked = true; else item.checked = false
                                })
                            }
                            w2menu.show(w2utils.extend({
                                    items,
                                }, it.overlay, {
                                    type: menuType,
                                    name : this.name + '-drop',
                                    anchor: el[0],
                                    data: { item: it, btn }
                                }))
                                .hide(hideDrop(it.id, btn))
                                .remove(event => {
                                    obj.menuClick({ name: obj.name, remove: true, item: it, subItem: event.detail.item,
                                        originalEvent: event })
                                })
                                .select(event => {
                                    obj.menuClick({ name: obj.name, item: it, subItem: event.detail.item,
                                        originalEvent: event })
                                })
                        }
                        if (['color', 'text-color'].includes(it.type)) {
                            w2color.show(w2utils.extend({
                                    color: it.color
                                }, it.overlay, {
                                    anchor: el[0],
                                    name: this.name + '-drop',
                                    data: { item: it, btn }
                                }))
                                .hide(hideDrop(it.id, btn))
                                .select(event => {
                                    if (event.detail.color != null) {
                                        obj.colorClick({ name: obj.name, item: it, color: event.detail.color })
                                    }
                                })
                        }
                    }, 0)
                }
            }
            if (['check', 'menu', 'menu-radio', 'menu-check', 'drop', 'color', 'text-color'].includes(it.type)) {
                it.checked = !it.checked
                if (it.checked) {
                    query(this.box).find(btn).addClass('checked')
                } else {
                    query(this.box).find(btn).removeClass('checked')
                }
            }
            // route processing
            if (it.route) {
                let route = String('/'+ it.route).replace(/\/{2,}/g, '/')
                let info  = w2utils.parseRoute(route)
                if (info.keys.length > 0) {
                    for (let k = 0; k < info.keys.length; k++) {
                        route = route.replace((new RegExp(':'+ info.keys[k].name, 'g')), this.routeData[info.keys[k].name])
                    }
                }
                setTimeout(() => { window.location.hash = route }, 1)
            }
            if (['button', 'check', 'radio'].includes(it.type)) {
                // need to refresh toolbar as it might be dynamic
                this.tooltipShow(id)
            }
            // event after
            edata.finish()
        }
    }
    scroll(direction, line, instant) {
        return new Promise((resolve, reject) => {
            let scrollBox  = query(this.box).find(`.w2ui-tb-line:nth-child(${line}) .w2ui-scroll-wrapper`)
            let scrollLeft = scrollBox.get(0).scrollLeft
            let right      = scrollBox.find('.w2ui-tb-right').get(0)
            let width1     = scrollBox.parent().get(0).getBoundingClientRect().width
            let width2     = scrollLeft + parseInt(right.offsetLeft) + parseInt(right.clientWidth )
            switch (direction) {
                case 'left': {
                    scroll = scrollLeft - width1 + 50 // 35 is width of both button
                    if (scroll <= 0) scroll = 0
                    scrollBox.get(0).scrollTo({ top: 0, left: scroll, behavior: instant ? 'atuo' : 'smooth' })
                    break
                }
                case 'right': {
                    scroll = scrollLeft + width1 - 50 // 35 is width of both button
                    if (scroll >= width2 - width1) scroll = width2 - width1
                    scrollBox.get(0).scrollTo({ top: 0, left: scroll, behavior: instant ? 'atuo' : 'smooth' })
                    break
                }
            }
            setTimeout(() => { this.resize(); resolve() }, instant ? 0 : 500)
        })
    }
    render(box) {
        let time = (new Date()).getTime()
        // event before
        let edata = this.trigger('render', { target: this.name, box: box })
        if (edata.isCancelled === true) return
        if (box != null) {
            if (query(this.box).find('.w2ui-scroll-wrapper .w2ui-tb-right').length > 0) {
                query(this.box)
                    .removeAttr('name')
                    .removeClass('w2ui-reset w2ui-toolbar')
                    .html('')
            }
            this.box = box
        }
        if (!this.box) return
        if (!Array.isArray(this.right)) {
            this.right = [this.right]
        }
        // render all buttons
        let html = ''
        let line = 0
        for (let i = 0; i < this.items.length; i++) {
            let it = this.items[i]
            if (it == null) continue
            if (it.id == null) it.id = 'item_' + i
            if (it.caption != null) {
                console.log('NOTICE: toolbar item.caption property is deprecated, please use item.text. Item -> ', it)
            }
            if (it.hint != null) {
                console.log('NOTICE: toolbar item.hint property is deprecated, please use item.tooltip. Item -> ', it)
            }
            if (i === 0 || it.type == 'new-line') {
                line++
                html += `
                    <div class="w2ui-tb-line">
                        <div class="w2ui-scroll-wrapper w2ui-eaction" data-mousedown="resize">
                            <div class="w2ui-tb-right">${this.right[line-1] || ''}</div>
                        </div>
                        <div class="w2ui-scroll-left w2ui-eaction" data-click='["scroll", "left", "${line}"]'></div>
                        <div class="w2ui-scroll-right w2ui-eaction" data-click='["scroll", "right", "${line}"]'></div>
                    </div>
                `
            }
            it.line = line
        }
        query(this.box)
            .attr('name', this.name)
            .addClass('w2ui-reset w2ui-toolbar')
            .html(html)
        if (query(this.box).length > 0) {
            query(this.box)[0].style.cssText += this.style
        }
        w2utils.bindEvents(query(this.box).find('.w2ui-tb-line .w2ui-eaction'), this)
        // observe div resize
        this.last.resizeObserver = new ResizeObserver(() => { this.resize() })
        this.last.resizeObserver.observe(this.box)
        // refresh all
        this.refresh()
        this.resize()
        // event after
        edata.finish()
        return (new Date()).getTime() - time
    }
    refresh(id) {
        let time = (new Date()).getTime()
        // event before
        let edata = this.trigger('refresh', { target: (id != null ? id : this.name), item: this.get(id) })
        if (edata.isCancelled === true) return
        let edata2
        // refresh all
        if (id == null) {
            for (let i = 0; i < this.items.length; i++) {
                let it1 = this.items[i]
                if (it1.id == null) it1.id = 'item_' + i
                this.refresh(it1.id)
            }
            return
        }
        // create or refresh only one item
        let it = this.get(id)
        if (it == null) return false
        if (typeof it.onRefresh == 'function') {
            edata2 = this.trigger('refresh', { target: id, item: it, object: it })
            if (edata2.isCancelled === true) return
        }
        let selector = `#tb_${this.name}_item_${w2utils.escapeId(it.id)}`
        let btn  = query(this.box).find(selector)
        let html = this.getItemHTML(it)
        // hide tooltip
        this.tooltipHide(id)
        // if there is a spacer, then right HTML is not 100%
        if (it.type == 'spacer') {
            query(this.box).find(`.w2ui-tb-line:nth-child(${it.line}`).find('.w2ui-tb-right').css('width', 'auto')
        }
        if (btn.length === 0) {
            let next = parseInt(this.get(id, true)) + 1
            let $next = query(this.box).find(`#tb_${this.name}_item_${w2utils.escapeId(this.items[next] ? this.items[next].id : '')}`)
            if ($next.length == 0) {
                $next = query(this.box).find(`.w2ui-tb-line:nth-child(${it.line}`).find('.w2ui-tb-right').before(html)
            } else {
                $next.after(html)
            }
            w2utils.bindEvents(query(this.box).find(selector), this)
        } else {
            // refresh
            query(this.box).find(selector).replace(query.html(html))
            let newBtn = query(this.box).find(selector).get(0)
            w2utils.bindEvents(newBtn, this)
            // update overlay's anchor if changed
            let overlays = w2tooltip.get(true)
            Object.keys(overlays).forEach(key => {
                if (overlays[key].anchor == btn.get(0)) {
                    overlays[key].anchor = newBtn
                }
            })
        }
        // event after
        if (typeof it.onRefresh == 'function') {
            edata2.finish()
        }
        edata.finish()
        return (new Date()).getTime() - time
    }
    resize() {
        let time = (new Date()).getTime()
        // event before
        let edata = this.trigger('resize', { target: this.name })
        if (edata.isCancelled === true) return
        query(this.box).find('.w2ui-tb-line').each(el => {
            // show hide overflow buttons
            let box = query(el)
            box.find('.w2ui-scroll-left, .w2ui-scroll-right').hide()
            let scrollBox  = box.find('.w2ui-scroll-wrapper').get(0)
            let $right     = box.find('.w2ui-tb-right')
            let boxWidth   = box.get(0).getBoundingClientRect().width
            let itemsWidth = ($right.length > 0 ? $right[0].offsetLeft + $right[0].clientWidth : 0)
            if (boxWidth < itemsWidth) {
                // we have overflown content
                if (scrollBox.scrollLeft > 0) {
                    box.find('.w2ui-scroll-left').show()
                }
                if (boxWidth < itemsWidth - scrollBox.scrollLeft) {
                    box.find('.w2ui-scroll-right').show()
                }
            }
        })
        // event after
        edata.finish()
        return (new Date()).getTime() - time
    }
    destroy() {
        // event before
        let edata = this.trigger('destroy', { target: this.name })
        if (edata.isCancelled === true) return
        // clean up
        if (query(this.box).find('.w2ui-scroll-wrapper  .w2ui-tb-right').length > 0) {
            query(this.box)
                .removeAttr('name')
                .removeClass('w2ui-reset w2ui-toolbar')
                .html('')
        }
        query(this.box).html('')
        this.last.resizeObserver?.disconnect()
        delete w2ui[this.name]
        // event after
        edata.finish()
    }
    // ========================================
    // --- Internal Functions
    getItemHTML(item) {
        let html = ''
        if (item.caption != null && item.text == null) item.text = item.caption // for backward compatibility
        if (item.text == null) item.text = ''
        if (item.tooltip == null && item.hint != null) item.tooltip = item.hint // for backward compatibility
        if (item.tooltip == null) item.tooltip = ''
        if (typeof item.get !== 'function' && (Array.isArray(item.items) || typeof item.items == 'function')) {
            item.get = function get(id) { // need scope, cannot be arrow func
                let tmp = item.items
                if (typeof tmp == 'function') tmp = item.items(item)
                return tmp.find(it => it.id == id ? true : false)
            }
        }
        let icon = ''
        let text = (typeof item.text == 'function' ? item.text.call(this, item) : item.text)
        if (item.icon) {
            icon = item.icon
            if (typeof item.icon == 'function') {
                icon = item.icon.call(this, item)
            }
            if (String(icon).substr(0, 1) !== '<') {
                icon = `<span class="${icon}"></span>`
            }
            icon = `<div class="w2ui-tb-icon">${icon}</div>`
        }
        let classes = ['w2ui-tb-button']
        if (item.checked) classes.push('checked')
        if (item.disabled) classes.push('disabled')
        if (item.hidden) classes.push('hidden')
        if (!icon) classes.push('no-icon')
        switch (item.type) {
            case 'color':
            case 'text-color':
                if (typeof item.color == 'string') {
                    if (item.color.substr(0,1) == '#') item.color = item.color.substr(1)
                    if ([3, 6, 8].includes(item.color.length)) item.color = '#' + item.color
                }
                if (item.type == 'color') {
                    text = `<span class="w2ui-tb-color-box" style="background-color: ${(item.color != null ? item.color : '#fff')}"></span>
                           ${(item.text ? `<div style="margin-left: 17px;">${w2utils.lang(item.text)}</div>` : '')}`
                }
                if (item.type == 'text-color') {
                    text = '<span style="color: '+ (item.color != null ? item.color : '#444') +';">'+
                                (item.text ? w2utils.lang(item.text) : '<b>Aa</b>') +
                           '</span>'
                }
            case 'menu':
            case 'menu-check':
            case 'menu-radio':
            case 'button':
            case 'check':
            case 'radio':
            case 'drop': {
                let arrow = (item.arrow === true
                    || (item.arrow !== false && ['menu', 'menu-radio', 'menu-check', 'drop', 'color', 'text-color'].includes(item.type)))
                html = `
                    <div id="tb_${this.name}_item_${item.id}" style="${(item.hidden ? 'display: none' : '')}"
                        class="${classes.join(' ')} ${(item.class ? item.class : '')}"
                        ${!item.disabled
                            ? `data-click='["click","${item.id}"]'
                               data-mouseenter='["mouseAction", "event", "this", "enter", "${item.id}"]'
                               data-mouseleave='["mouseAction", "event", "this", "leave", "${item.id}"]'
                               data-mousedown='["mouseAction", "event", "this", "down", "${item.id}"]'
                               data-mouseup='["mouseAction", "event", "this", "up", "${item.id}"]'`
                            : ''}
                    >
                        ${ icon }
                        ${ text != ''
                            ? `<div class="w2ui-tb-text" style="${(item.style ? item.style : '')}">
                                    ${ w2utils.lang(text) }
                                    ${ item.count != null
                                        ? `<span class="w2ui-tb-count">
                                                <span class="${this.last.badge[item.id] ? this.last.badge[item.id].className || '' : ''}"
                                                    style="${this.last.badge[item.id] ? this.last.badge[item.id].style || '' : ''}">
                                                        ${item.count}
                                                </span>
                                           </span>`
                                        : ''
                                    }
                                    ${ arrow
                                        ? '<span class="w2ui-tb-down"><span></span></span>'
                                        : ''
                                    }
                                </div>`
                            : ''}
                    </div>
                `
                break
            }
            case 'break':
                html = `<div id="tb_${this.name}_item_${item.id}" class="w2ui-tb-break"
                            style="${(item.hidden ? 'display: none' : '')}; ${(item.style ? item.style : '')}">
                            &#160;
                        </div>`
                break
            case 'spacer':
                html = `<div id="tb_${this.name}_item_${item.id}" class="w2ui-tb-spacer"
                            style="${(item.hidden ? 'display: none' : '')}; ${(item.style ? item.style : '')}">
                        </div>`
                break
            case 'html':
                html = `<div id="tb_${this.name}_item_${item.id}" class="w2ui-tb-html ${classes.join(' ')}"
                            style="${(item.hidden ? 'display: none' : '')}; ${(item.style ? item.style : '')}">
                            ${(typeof item.html == 'function' ? item.html.call(this, item) : item.html)}
                        </div>`
                break
        }
        return html
    }
    tooltipShow(id) {
        if (this.tooltip == null) return
        let el   = query(this.box).find('#tb_'+ this.name + '_item_'+ w2utils.escapeId(id)).get(0)
        let item = this.get(id)
        let pos  = this.tooltip
        let txt  = item.tooltip
        if (typeof txt == 'function') txt = txt.call(this, item)
        // not for opened drop downs
        if (['menu', 'menu-radio', 'menu-check', 'drop', 'color', 'text-color'].includes(item.type)
            && item.checked == true) {
                return
        }
        w2tooltip.show({
            anchor: el,
            name: this.name + '-tooltip',
            html: txt,
            position: pos
        })
        return
    }
    tooltipHide(id) {
        if (this.tooltip == null) return
        w2tooltip.hide(this.name + '-tooltip')
    }
    menuClick(event) {
        let obj = this
        if (event.item && !event.item.disabled) {
            // event before
            let edata = this.trigger((event.remove !== true ? 'click' : 'remove'), {
                target: event.item.id + ':' + event.subItem.id, item: event.item,
                subItem: event.subItem, originalEvent: event.originalEvent
            })
            if (edata.isCancelled === true) return
            // route processing
            let it    = event.subItem
            let item  = this.get(event.item.id)
            let items = item.items
            if (typeof items == 'function') items = item.items()
            if (item.type == 'menu-radio') {
                item.selected = it.id
                if (Array.isArray(items)) {
                    items.forEach((item) => {
                        if (item.checked === true) delete item.checked
                        if (Array.isArray(item.items)) {
                            item.items.forEach((item) => {
                                if (item.checked === true) delete item.checked
                            })
                        }
                    })
                }
                it.checked = true
            }
            if (item.type == 'menu-check') {
                if (!Array.isArray(item.selected)) item.selected = []
                if (it.group == null) {
                    let ind = item.selected.indexOf(it.id)
                    if (ind == -1) {
                        item.selected.push(it.id)
                        it.checked = true
                    } else {
                        item.selected.splice(ind, 1)
                        it.checked = false
                    }
                } else if (it.group === false) {
                    // if group is false, then it is not part of checkboxes
                } else {
                    let unchecked = [];
                    // recursive
                    (function checkNested(items) {
                        items.forEach((sub) => {
                            if (sub.group === it.group) {
                                let ind = item.selected.indexOf(sub.id)
                                if (ind != -1) {
                                    if (sub.id != it.id) unchecked.push(sub.id)
                                    item.selected.splice(ind, 1)
                                }
                            }
                            if (Array.isArray(sub.items)) checkNested(sub.items)
                        })
                    })(items)
                    let ind = item.selected.indexOf(it.id)
                    if (ind == -1) {
                        item.selected.push(it.id)
                        it.checked = true
                    }
                }
            }
            if (typeof it.route == 'string') {
                let route = it.route !== '' ? String('/'+ it.route).replace(/\/{2,}/g, '/') : ''
                let info  = w2utils.parseRoute(route)
                if (info.keys.length > 0) {
                    for (let k = 0; k < info.keys.length; k++) {
                        if (obj.routeData[info.keys[k].name] == null) continue
                        route = route.replace((new RegExp(':'+ info.keys[k].name, 'g')), this.routeData[info.keys[k].name])
                    }
                }
                setTimeout(() => { window.location.hash = route }, 1)
            }
            this.refresh(event.item.id)
            // event after
            edata.finish()
        }
    }
    colorClick(event) {
        let obj = this
        if (event.item && !event.item.disabled) {
            // event before
            let edata = this.trigger('click', {
                target: event.item.id, item: event.item,
                color: event.color, final: event.final, originalEvent: event.originalEvent
            })
            if (edata.isCancelled === true) return
            // default behavior
            event.item.color = event.color
            obj.refresh(event.item.id)
            // event after
            edata.finish()
        }
    }
    mouseAction(event, target, action, id) {
        let btn = this.get(id)
        if (btn.disabled || btn.hidden) return
        switch (action) {
            case 'enter':
                query(target).addClass('over')
                this.tooltipShow(id)
                break
            case 'leave':
                query(target).removeClass('over down')
                this.tooltipHide(id)
                break
            case 'down':
                query(target).addClass('down')
                break
            case 'up':
                query(target).removeClass('down')
                break
        }
    }
}
/**
 * Part of w2ui 2.0 library
 *  - Dependencies: mQuery, w2utils, w2base, w2tooltip, w2menu
 *
 * == TODO ==
 *  - dbl click should be like it is in grid (with timer not HTML dbl click event)
 *  - node.style is misleading - should be there to apply color for example
 *  - node.plus - is not working
 *
 * == 2.0 changes
 *  - remove jQuery dependency
 *  - deprecarted obj.img, node.img
 *  - CSP - fixed inline events
 *  - resizeObserver for the box
 */

class w2sidebar extends w2base {
    constructor(options) {
        super(options.name)
        this.name          = null
        this.box           = null
        this.sidebar       = null
        this.parent        = null
        this.nodes         = [] // Sidebar child nodes
        this.menu          = []
        this.routeData     = {} // data for dynamic routes
        this.selected      = null // current selected node (readonly)
        this.icon          = null
        this.style         = ''
        this.topHTML       = ''
        this.bottomHTML    = ''
        this.flatButton    = false
        this.keyboard      = true
        this.flat          = false
        this.hasFocus      = false
        this.levelPadding  = 12
        this.skipRefresh   = false
        this.tabIndex      = null // will only be set if > 0 and not null
        this.handle        = { size: 0, style: '', html: '' },
        this.onClick       = null // Fire when user click on Node Text
        this.onDblClick    = null // Fire when user dbl clicks
        this.onContextMenu = null
        this.onMenuClick   = null // when context menu item selected
        this.onExpand      = null // Fire when node expands
        this.onCollapse    = null // Fire when node collapses
        this.onKeydown     = null
        this.onRender      = null
        this.onRefresh     = null
        this.onResize      = null
        this.onDestroy     = null
        this.onFocus       = null
        this.onBlur        = null
        this.onFlat        = null
        this.node_template = {
            id: null,
            text: '',
            order: null,
            count: null,
            icon: null,
            nodes: [],
            style: '', // additional style for subitems
            route: null,
            selected: false,
            expanded: false,
            hidden: false,
            disabled: false,
            group: false, // if true, it will build as a group
            groupShowHide: true,
            collapsible: false,
            plus: false, // if true, plus will be shown even if there is no sub nodes
            // events
            onClick: null,
            onDblClick: null,
            onContextMenu: null,
            onExpand: null,
            onCollapse: null,
            // internal
            parent: null, // node object
            sidebar: null
        }
        this.last = {
            badge: {}
        }
        let nodes = options.nodes
        delete options.nodes
        // mix in options
        Object.assign(this, options)
        // add item via method to makes sure item_template is applied
        if (Array.isArray(nodes)) this.add(nodes)
        // need to reassign back to keep it in config
        options.nodes = nodes
    }
    add(parent, nodes) {
        if (arguments.length == 1) {
            // need to be in reverse order
            nodes  = arguments[0]
            parent = this
        }
        if (typeof parent == 'string') parent = this.get(parent)
        if (parent == null || parent == '') parent = this
        return this.insert(parent, null, nodes)
    }
    insert(parent, before, nodes) {
        let txt, ind, tmp, node, nd
        if (arguments.length == 2 && typeof parent == 'string') {
            // need to be in reverse order
            nodes  = arguments[1]
            before = arguments[0]
            if (before != null) {
                ind = this.get(before)
                if (ind == null) {
                    if (!Array.isArray(nodes)) nodes = [nodes]
                    if (nodes[0].caption != null && nodes[0].text == null) {
                        console.log('NOTICE: sidebar node.caption property is deprecated, please use node.text. Node -> ', nodes[0])
                        nodes[0].text = nodes[0].caption
                    }
                    txt = nodes[0].text
                    console.log('ERROR: Cannot insert node "'+ txt +'" because cannot find node "'+ before +'" to insert before.')
                    return null
                }
                parent = this.get(before).parent
            } else {
                parent = this
            }
        }
        if (typeof parent == 'string') parent = this.get(parent)
        if (parent == null || parent == '') parent = this
        if (!Array.isArray(nodes)) nodes = [nodes]
        for (let o = 0; o < nodes.length; o++) {
            node = nodes[o]
            if (node.caption != null && node.text == null) {
                console.log('NOTICE: sidebar node.caption property is deprecated, please use node.text')
                node.text = node.caption
            }
            if (typeof node.id == null) {
                txt = node.text
                console.log('ERROR: Cannot insert node "'+ txt +'" because it has no id.')
                continue
            }
            if (this.get(this, node.id) != null) {
                console.log('ERROR: Cannot insert node with id='+ node.id +' (text: '+ node.text + ') because another node with the same id already exists.')
                continue
            }
            tmp         = Object.assign({}, this.node_template, node)
            tmp.sidebar = this
            tmp.parent  = parent
            nd          = tmp.nodes || []
            tmp.nodes   = [] // very important to re-init empty nodes array
            if (before == null) { // append to the end
                parent.nodes.push(tmp)
            } else {
                ind = this.get(parent, before, true)
                if (ind == null) {
                    console.log('ERROR: Cannot insert node "'+ node.text +'" because cannot find node "'+ before +'" to insert before.')
                    return null
                }
                parent.nodes.splice(ind, 0, tmp)
            }
            if (nd.length > 0) {
                this.insert(tmp, null, nd)
            }
        }
        if (!this.skipRefresh) this.refresh(parent.id)
        return tmp
    }
    remove() { // multiple arguments
        let effected = 0
        let node
        Array.from(arguments).forEach(arg => {
            node = this.get(arg)
            if (node == null) return
            if (this.selected != null && this.selected === node.id) {
                this.selected = null
            }
            let ind = this.get(node.parent, arg, true)
            if (ind == null) return
            if (node.parent.nodes[ind].selected) node.sidebar.unselect(node.id)
            node.parent.nodes.splice(ind, 1)
            effected++
        })
        if (!this.skipRefresh) {
            if (effected > 0 && arguments.length == 1) this.refresh(node.parent.id); else this.refresh()
        }
        return effected
    }
    set(parent, id, node) {
        if (arguments.length == 2) {
            // need to be in reverse order
            node   = id
            id     = parent
            parent = this
        }
        // searches all nested nodes
        if (typeof parent == 'string') parent = this.get(parent)
        if (parent.nodes == null) return null
        for (let i = 0; i < parent.nodes.length; i++) {
            if (parent.nodes[i].id === id) {
                // see if quick update is possible
                let res = this.update(id, node)
                if (Object.keys(res).length != 0) {
                    // make sure nodes inserted correctly
                    let nodes = node.nodes
                    w2utils.extend(parent.nodes[i], node, { nodes: [] })
                    if (nodes != null) {
                        this.add(parent.nodes[i], nodes)
                    }
                    if (!this.skipRefresh) this.refresh(id)
                }
                return true
            } else {
                let rv = this.set(parent.nodes[i], id, node)
                if (rv) return true
            }
        }
        return false
    }
    get(parent, id, returnIndex) { // can be just called get(id) or get(id, true)
        if (arguments.length === 0) {
            let all = []
            let tmp = this.find({})
            for (let t = 0; t < tmp.length; t++) {
                if (tmp[t].id != null) all.push(tmp[t].id)
            }
            return all
        } else {
            if (arguments.length == 1 || (arguments.length == 2 && id === true) ) {
                // need to be in reverse order
                returnIndex = id
                id          = parent
                parent      = this
            }
            // searches all nested nodes
            if (typeof parent == 'string') parent = this.get(parent)
            if (parent.nodes == null) return null
            for (let i = 0; i < parent.nodes.length; i++) {
                if (parent.nodes[i].id == id) {
                    if (returnIndex === true) return i; else return parent.nodes[i]
                } else {
                    let rv = this.get(parent.nodes[i], id, returnIndex)
                    if (rv || rv === 0) return rv
                }
            }
            return null
        }
    }
    setCount(id, count, className, style) {
        let btn = query(this.box).find(`#node_${w2utils.escapeId(id)} .w2ui-node-count`)
        if (btn.length > 0) {
            btn.removeClass()
                .addClass(`w2ui-node-count ${className || ''}`)
                .text(count)
                .get(0).style.cssText = style || ''
            this.last.badge[id] = {
                className: className || '',
                style: style || ''
            }
            let item = this.get(id)
            item.count = count
        } else {
            this.set(id, { count: count })
            this.setCount(...arguments) // to update styles
        }
    }
    find(parent, params, results) { // can be just called find({ selected: true })
        // TODO: rewrite with this.each()
        if (arguments.length == 1) {
            // need to be in reverse order
            params = parent
            parent = this
        }
        if (!results) results = []
        // searches all nested nodes
        if (typeof parent == 'string') parent = this.get(parent)
        if (parent.nodes == null) return results
        for (let i = 0; i < parent.nodes.length; i++) {
            let match = true
            for (let prop in params) { // params is an object
                if (parent.nodes[i][prop] != params[prop]) match = false
            }
            if (match) results.push(parent.nodes[i])
            if (parent.nodes[i].nodes.length > 0) results = this.find(parent.nodes[i], params, results)
        }
        return results
    }
    sort(options, nodes) {
        // default options
        if (!options || typeof options != 'object') options = {}
        if (options.foldersFirst == null) options.foldersFirst = true
        if (options.caseSensitive == null) options.caseSensitive = false
        if (options.reverse == null) options.reverse = false
        if (nodes == null) {
            nodes = this.nodes
        }
        nodes.sort((a, b) => {
            // folders first
            let isAfolder = (a.nodes && a.nodes.length > 0)
            let isBfolder = (b.nodes && b.nodes.length > 0)
            // both folder or both not folders
            if (options.foldersFirst === false || (!isAfolder && !isBfolder) || (isAfolder && isBfolder)) {
                let aText = a.text
                let bText = b.text
                if (!options.caseSensitive) {
                    aText = aText.toLowerCase()
                    bText = bText.toLowerCase()
                }
                if (a.order != null) aText = a.order
                if (b.order != null) bText = b.order
                let cmp = w2utils.naturalCompare(aText, bText)
                return (cmp === 1 || cmp === -1) & options.reverse ? -cmp : cmp
            }
            if (isAfolder && !isBfolder) {
                return !options.reverse ? -1 : 1
            }
            if (!isAfolder && isBfolder) {
                return !options.reverse ? 1 : -1
            }
        })
        nodes.forEach(node => {
            if (node.nodes && node.nodes.length > 0) {
                this.sort(options, node.nodes)
            }
        })
    }
    each(fn, nodes) {
        if (nodes == null) nodes = this.nodes
        nodes.forEach((node) => {
            fn.call(this, node)
            if (node.nodes && node.nodes.length > 0) {
                this.each(fn, node.nodes)
            }
        })
    }
    search(str) {
        let count = 0
        let str2  = str.toLowerCase()
        this.each((node) => {
            if (node.text.toLowerCase().indexOf(str2) === -1) {
                node.hidden = true
            } else {
                count++
                showParents(node)
                node.hidden = false
            }
        })
        this.refresh()
        return count
        function showParents(node) {
            if (node.parent) {
                node.parent.hidden = false
                showParents(node.parent)
            }
        }
    }
    show() { // multiple arguments
        let effected = []
        Array.from(arguments).forEach(it => {
            let node = this.get(it)
            if (node == null || node.hidden === false) return
            node.hidden = false
            effected.push(node.id)
        })
        if (effected.length > 0) {
            if (arguments.length == 1) this.refresh(arguments[0]); else this.refresh()
        }
        return effected
    }
    hide() { // multiple arguments
        let effected = []
        Array.from(arguments).forEach(it => {
            let node = this.get(it)
            if (node == null || node.hidden === true) return
            node.hidden = true
            effected.push(node.id)
        })
        if (effected.length > 0) {
            if (arguments.length == 1) this.refresh(arguments[0]); else this.refresh()
        }
        return effected
    }
    enable() { // multiple arguments
        let effected = []
        Array.from(arguments).forEach(it => {
            let node = this.get(it)
            if (node == null || node.disabled === false) return
            node.disabled = false
            effected.push(node.id)
        })
        if (effected.length > 0) {
            if (arguments.length == 1) this.refresh(arguments[0]); else this.refresh()
        }
        return effected
    }
    disable() { // multiple arguments
        let effected = []
        Array.from(arguments).forEach(it => {
            let node = this.get(it)
            if (node == null || node.disabled === true) return
            node.disabled = true
            if (node.selected) this.unselect(node.id)
            effected.push(node.id)
        })
        if (effected.length > 0) {
            if (arguments.length == 1) this.refresh(arguments[0]); else this.refresh()
        }
        return effected
    }
    select(id) {
        let new_node = this.get(id)
        if (!new_node) return false
        if (this.selected == id && new_node.selected) return false
        this.unselect(this.selected)
        let $el = query(this.box).find('#node_'+ w2utils.escapeId(id))
        $el.addClass('w2ui-selected')
            .find('.w2ui-icon')
            .addClass('w2ui-icon-selected')
        if ($el.length > 0) {
            if (!this.inView(id)) this.scrollIntoView(id)
        }
        new_node.selected = true
        this.selected = id
        return true
    }
    unselect(id) {
        // if no arguments provided, unselect selected node
        if (arguments.length === 0) {
            id = this.selected
        }
        let current = this.get(id)
        if (!current) return false
        current.selected = false
        query(this.box).find('#node_'+ w2utils.escapeId(id))
            .removeClass('w2ui-selected')
            .find('.w2ui-icon').removeClass('w2ui-icon-selected')
        if (this.selected == id) this.selected = null
        return true
    }
    toggle(id) {
        let nd = this.get(id)
        if (nd == null) return false
        if (nd.plus) {
            this.set(id, { plus: false })
            this.expand(id)
            this.refresh(id)
            return
        }
        if (nd.nodes.length === 0) return false
        if (!nd.collapsible) return false
        if (this.get(id).expanded) return this.collapse(id); else return this.expand(id)
    }
    collapse(id) {
        let self = this
        let nd = this.get(id)
        if (nd == null) return false
        // event before
        let edata = this.trigger('collapse', { target: id, object: nd })
        if (edata.isCancelled === true) return
        // default action
        query(this.box).find('#node_'+ w2utils.escapeId(id) +'_sub').hide()
        query(this.box).find('#node_'+ w2utils.escapeId(id) +' .w2ui-expanded')
            .removeClass('w2ui-expanded')
            .addClass('w2ui-collapsed')
        nd.expanded = false
        // event after
        edata.finish()
        setTimeout(() => { self.refresh(id) }, 0)
        return true
    }
    expand(id) {
        let self = this
        let nd = this.get(id)
        // event before
        let edata = this.trigger('expand', { target: id, object: nd })
        if (edata.isCancelled === true) return
        // default action
        query(this.box).find('#node_'+ w2utils.escapeId(id) +'_sub')
            .show()
        query(this.box).find('#node_'+ w2utils.escapeId(id) +' .w2ui-collapsed')
            .removeClass('w2ui-collapsed')
            .addClass('w2ui-expanded')
        nd.expanded = true
        // event after
        edata.finish()
        setTimeout(() => { self.refresh(id) }, 0)
        return true
    }
    collapseAll(parent) {
        if (parent == null) parent = this
        if (typeof parent == 'string') parent = this.get(parent)
        if (parent.nodes == null) return false
        for (let i = 0; i < parent.nodes.length; i++) {
            if (parent.nodes[i].expanded === true) parent.nodes[i].expanded = false
            if (parent.nodes[i].nodes && parent.nodes[i].nodes.length > 0) this.collapseAll(parent.nodes[i])
        }
        this.refresh(parent.id)
        return true
    }
    expandAll(parent) {
        if (parent == null) parent = this
        if (typeof parent == 'string') parent = this.get(parent)
        if (parent.nodes == null) return false
        for (let i = 0; i < parent.nodes.length; i++) {
            if (parent.nodes[i].expanded === false) parent.nodes[i].expanded = true
            if (parent.nodes[i].nodes && parent.nodes[i].nodes.length > 0) this.expandAll(parent.nodes[i])
        }
        this.refresh(parent.id)
    }
    expandParents(id) {
        let node = this.get(id)
        if (node == null) return false
        if (node.parent) {
            if (!node.parent.expanded) {
                node.parent.expanded = true
                this.refresh(node.parent.id)
            }
            this.expandParents(node.parent.id)
        }
        return true
    }
    click(id, event) {
        let obj = this
        let nd  = this.get(id)
        if (nd == null) return
        if (nd.disabled || nd.group) return // should click event if already selected
        // unselect all previously
        query(obj.box).find('.w2ui-node.w2ui-selected').each(el => {
            let oldID   = query(el).attr('id').replace('node_', '')
            let oldNode = obj.get(oldID)
            if (oldNode != null) oldNode.selected = false
            query(el).removeClass('w2ui-selected').find('.w2ui-icon').removeClass('w2ui-icon-selected')
        })
        // select new one
        let newNode = query(obj.box).find('#node_'+ w2utils.escapeId(id))
        let oldNode = query(obj.box).find('#node_'+ w2utils.escapeId(obj.selected))
        newNode.addClass('w2ui-selected').find('.w2ui-icon').addClass('w2ui-icon-selected')
        // need timeout to allow rendering
        setTimeout(() => {
            // event before
            let edata = obj.trigger('click', { target: id, originalEvent: event, node: nd, object: nd })
            if (edata.isCancelled === true) {
                // restore selection
                newNode.removeClass('w2ui-selected').find('.w2ui-icon').removeClass('w2ui-icon-selected')
                oldNode.addClass('w2ui-selected').find('.w2ui-icon').addClass('w2ui-icon-selected')
                return
            }
            // default action
            if (oldNode != null) oldNode.selected = false
            obj.get(id).selected = true
            obj.selected = id
            // route processing
            if (typeof nd.route == 'string') {
                let route = nd.route !== '' ? String('/'+ nd.route).replace(/\/{2,}/g, '/') : ''
                let info  = w2utils.parseRoute(route)
                if (info.keys.length > 0) {
                    for (let k = 0; k < info.keys.length; k++) {
                        if (obj.routeData[info.keys[k].name] == null) continue
                        route = route.replace((new RegExp(':'+ info.keys[k].name, 'g')), obj.routeData[info.keys[k].name])
                    }
                }
                setTimeout(() => { window.location.hash = route }, 1)
            }
            // event after
            edata.finish()
        }, 1)
    }
    focus(event) {
        let self = this
        // event before
        let edata = this.trigger('focus', { target: this.name, originalEvent: event })
        if (edata.isCancelled === true) return false
        // default behaviour
        this.hasFocus = true
        query(this.box).find('.w2ui-sidebar-body').addClass('w2ui-focus')
        setTimeout(() => {
            let input = query(self.box).find('#sidebar_'+ self.name + '_focus').get(0)
            if (document.activeElement != input) input.focus()
        }, 10)
        // event after
        edata.finish()
    }
    blur(event) {
        // event before
        let edata = this.trigger('blur', { target: this.name, originalEvent: event })
        if (edata.isCancelled === true) return false
        // default behaviour
        this.hasFocus = false
        query(this.box).find('.w2ui-sidebar-body').removeClass('w2ui-focus')
        // event after
        edata.finish()
    }
    keydown(event) {
        let obj = this
        let nd  = obj.get(obj.selected)
        if (obj.keyboard !== true) return
        if (!nd) nd = obj.nodes[0]
        // trigger event
        let edata = obj.trigger('keydown', { target: obj.name, originalEvent: event })
        if (edata.isCancelled === true) return
        // default behaviour
        if (event.keyCode == 13 || event.keyCode == 32) { // enter or space
            if (nd.nodes.length > 0) obj.toggle(obj.selected)
        }
        if (event.keyCode == 37) { // left
            if (nd.nodes.length > 0 && nd.expanded) {
                obj.collapse(obj.selected)
            } else {
                selectNode(nd.parent)
                if (!nd.parent.group) obj.collapse(nd.parent.id)
            }
        }
        if (event.keyCode == 39) { // right
            if ((nd.nodes.length > 0 || nd.plus) && !nd.expanded) obj.expand(obj.selected)
        }
        if (event.keyCode == 38) { // up
            if (obj.get(obj.selected) == null) {
                selectNode(this.nodes[0] || null)
            } else {
                selectNode(neighbor(nd, prev))
            }
        }
        if (event.keyCode == 40) { // down
            if (obj.get(obj.selected) == null) {
                selectNode(this.nodes[0] || null)
            } else {
                selectNode(neighbor(nd, next))
            }
        }
        // cancel event if needed
        if ([13, 32, 37, 38, 39, 40].includes(event.keyCode)) {
            if (event.preventDefault) event.preventDefault()
            if (event.stopPropagation) event.stopPropagation()
        }
        // event after
        edata.finish()
        function selectNode(node, event) {
            if (node != null && !node.hidden && !node.disabled && !node.group) {
                obj.click(node.id, event)
                if (!obj.inView(node.id)) obj.scrollIntoView(node.id)
            }
        }
        function neighbor(node, neighborFunc) {
            node = neighborFunc(node)
            while (node != null && (node.hidden || node.disabled)) {
                if (node.group) break; else node = neighborFunc(node)
            }
            return node
        }
        function next(node, noSubs) {
            if (node == null) return null
            let parent   = node.parent
            let ind      = obj.get(node.id, true)
            let nextNode = null
            // jump inside
            if (node.expanded && node.nodes.length > 0 && noSubs !== true) {
                let t = node.nodes[0]
                if (t.hidden || t.disabled || t.group) nextNode = next(t); else nextNode = t
            } else {
                if (parent && ind + 1 < parent.nodes.length) {
                    nextNode = parent.nodes[ind + 1]
                } else {
                    nextNode = next(parent, true) // jump to the parent
                }
            }
            if (nextNode != null && (nextNode.hidden || nextNode.disabled || nextNode.group)) nextNode = next(nextNode)
            return nextNode
        }
        function prev(node) {
            if (node == null) return null
            let parent   = node.parent
            let ind      = obj.get(node.id, true)
            let prevNode = (ind > 0) ? lastChild(parent.nodes[ind - 1]) : parent
            if (prevNode != null && (prevNode.hidden || prevNode.disabled || prevNode.group)) prevNode = prev(prevNode)
            return prevNode
        }
        function lastChild(node) {
            if (node.expanded && node.nodes.length > 0) {
                let t = node.nodes[node.nodes.length - 1]
                if (t.hidden || t.disabled || t.group) return prev(t); else return lastChild(t)
            }
            return node
        }
    }
    inView(id) {
        let item = query(this.box).find('#node_'+ w2utils.escapeId(id)).get(0)
        if (!item) {
            return false
        }
        let div = query(this.box).find('.w2ui-sidebar-body').get(0)
        if (item.offsetTop < div.scrollTop || (item.offsetTop + item.clientHeight > div.clientHeight + div.scrollTop)) {
            return false
        }
        return true
    }
    scrollIntoView(id, instant) {
        return new Promise((resolve, reject) => {
            if (id == null) id = this.selected
            let nd = this.get(id)
            if (nd == null) return
            let item = query(this.box).find('#node_'+ w2utils.escapeId(id)).get(0)
            item.scrollIntoView({ block: "center", inline: "center", behavior: instant ? 'atuo' : 'smooth' })
            setTimeout(() => { this.resize(); resolve() }, instant ? 0 : 500)
        })
    }
    dblClick(id, event) {
        let nd = this.get(id)
        // event before
        let edata = this.trigger('dblClick', { target: id, originalEvent: event, object: nd })
        if (edata.isCancelled === true) return
        // default action
        this.toggle(id)
        // event after
        edata.finish()
    }
    contextMenu(id, event) {
        let nd = this.get(id)
        if (id != this.selected) this.click(id)
        // event before
        let edata = this.trigger('contextMenu', { target: id, originalEvent: event, object: nd, allowOnDisabled: false })
        if (edata.isCancelled === true) return
        // default action
        if (nd.disabled && !edata.allowOnDisabled) return
        if (this.menu.length > 0) {
            w2menu.show({
                name: this.name + '_menu',
                anchor: document.body,
                items: this.menu,
                originalEvent: event
            })
            .select(evt => {
                this.menuClick(id, parseInt(evt.detail.index), event)
            })
        }
        // prevent default context menu
        if (event.preventDefault) event.preventDefault()
        // event after
        edata.finish()
    }
    menuClick(itemId, index, event) {
        // event before
        let edata = this.trigger('menuClick', { target: itemId, originalEvent: event, menuIndex: index, menuItem: this.menu[index] })
        if (edata.isCancelled === true) return
        // default action
        // -- empty
        // event after
        edata.finish()
    }
    goFlat() {
        // event before
        let edata = this.trigger('flat', { goFlat: !this.flat })
        if (edata.isCancelled === true) return
        // default action
        this.flat = !this.flat
        this.refresh()
        // event after
        edata.finish()
    }
    render(box) {
        let time = (new Date()).getTime()
        let obj  = this
        // event before
        let edata = this.trigger('render', { target: this.name, box: box })
        if (edata.isCancelled === true) return
        // default action
        if (box != null) {
            if (query(this.box).find('.w2ui-sidebar-body').length > 0) {
                query(this.box)
                    .removeAttr('name')
                    .removeClass('w2ui-reset w2ui-sidebar')
                    .html('')
            }
            this.box = box
        }
        if (!this.box) return
        query(this.box)
            .attr('name', this.name)
            .addClass('w2ui-reset w2ui-sidebar')
            .html(`<div>
                <div class="w2ui-sidebar-top"></div>
                <input id="sidebar_${this.name}_focus" ${(this.tabIndex ? 'tabindex="' + this.tabIndex + '"' : '')}
                    style="position: absolute; top: 0; right: 0; width: 1px; z-index: -1; opacity: 0"
                    ${(w2utils.isIOS ? 'readonly' : '')}/>
                <div class="w2ui-sidebar-body"></div>
                <div class="w2ui-sidebar-bottom"></div>
            </div>`)
        let rect = query(this.box).get(0).getBoundingClientRect()
        query(this.box).find(':scope > div').css({
            width  : rect.width + 'px',
            height : rect.height + 'px'
        })
        query(this.box).get(0).style.cssText += this.style
        // focus
        let kbd_timer
        query(this.box).find('#sidebar_'+ this.name + '_focus')
            .on('focus', function(event) {
                clearTimeout(kbd_timer)
                if (!obj.hasFocus) obj.focus(event)
            })
            .on('blur', function(event) {
                kbd_timer = setTimeout(() => {
                    if (obj.hasFocus) { obj.blur(event) }
                }, 100)
            })
            .on('keydown', function(event) {
                if (event.keyCode != 9) { // not tab
                    w2ui[obj.name].keydown.call(w2ui[obj.name], event)
                }
            })
        query(this.box).off('mousedown')
            .on('mousedown', function(event) {
                // set focus to grid
                setTimeout(() => {
                    // if input then do not focus
                    if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(event.target.tagName.toUpperCase()) == -1) {
                        let $input = query(obj.box).find('#sidebar_'+ obj.name + '_focus')
                        if (document.activeElement != $input.get(0)) {
                            $input.get(0).focus()
                        }
                    }
                }, 1)
            })
        // observe div resize
        this.last.resizeObserver = new ResizeObserver(() => { this.resize() })
        this.last.resizeObserver.observe(this.box)
        // event after
        edata.finish()
        // ---
        this.refresh()
        return (new Date()).getTime() - time
    }
    update(id, options) {
        // quick function to refresh just this item (not sub nodes)
        //  - icon, class, style, text, count
        let nd = this.get(id)
        let level
        if (nd) {
            let $el = query(this.box).find('#node_'+ w2utils.escapeId(nd.id))
            if (nd.group) {
                if (options.text) {
                    nd.text = options.text
                    $el.find('.w2ui-group-text').replace(typeof nd.text == 'function'
                        ? nd.text.call(this, nd)
                        : '<span class="w2ui-group-text">'+ nd.text +'</span>')
                    delete options.text
                }
                if (options.class) {
                    nd.class = options.class
                    level = $el.data('level')
                    $el.get(0).className = 'w2ui-node-group w2ui-level-'+ level +(nd.class ? ' ' + nd.class : '')
                    delete options.class
                }
                if (options.style) {
                    nd.style = options.style
                    $el.get(0).nextElementSibling.style = nd.style +';'+ (!nd.hidden && nd.expanded ? '' : 'display: none;')
                    delete options.style
                }
            } else {
                if (options.icon) {
                    let $icon = $el.find('.w2ui-node-image > span')
                    if ($icon.length > 0) {
                        nd.icon = options.icon
                        $icon[0].className = (typeof nd.icon == 'function' ? nd.icon.call(this, nd) : nd.icon)
                        delete options.icon
                    }
                }
                if (options.count) {
                    nd.count = options.count
                    $el.find('.w2ui-node-count').html(nd.count)
                    if ($el.find('.w2ui-node-count').length > 0) delete options.count
                }
                if (options.class && $el.length > 0) {
                    nd.class = options.class
                    level = $el.data('level')
                    $el[0].className = 'w2ui-node w2ui-level-'+ level + (nd.selected ? ' w2ui-selected' : '') + (nd.disabled ? ' w2ui-disabled' : '') + (nd.class ? ' ' + nd.class : '')
                    delete options.class
                }
                if (options.text) {
                    nd.text = options.text
                    $el.find('.w2ui-node-text').html(typeof nd.text == 'function' ? nd.text.call(this, nd) : nd.text)
                    delete options.text
                }
                if (options.style && $el.length > 0) {
                    let $txt = $el.find('.w2ui-node-text')
                    nd.style = options.style
                    $txt[0].style = nd.style
                    delete options.style
                }
            }
        }
        // return what was not set
        return options
    }
    refresh(id, noBinding) {
        if (this.box == null) return
        let time = (new Date()).getTime()
        // event before
        let edata = this.trigger('refresh', { target: (id != null ? id : this.name),
            fullRefresh: (id != null ? false : true) })
        if (edata.isCancelled === true) return
        // adjust top and bottom
        let flatHTML = ''
        if (this.flatButton == true) {
            flatHTML = `<div class="w2ui-flat w2ui-flat-${(this.flat ? 'right' : 'left')}"></div>`
        }
        if (id == null && (this.topHTML !== '' || flatHTML !== '')) {
            query(this.box).find('.w2ui-sidebar-top').html(this.topHTML + flatHTML)
            query(this.box).find('.w2ui-sidebar-body')
                .css('top', query(this.box).find('.w2ui-sidebar-top').get(0).clientHeight + 'px')
            query(this.box).find('.w2ui-flat')
                .off('clcik')
                .on('click', event => { this.goFlat() })
        }
        if (id != null && this.bottomHTML !== '') {
            query(this.box).find('.w2ui-sidebar-bottom').html(this.bottomHTML)
            query(this.box).find('.w2ui-sidebar-body')
                .css('bottom', query(this.box).find('.w2ui-sidebar-bottom').get(0).clientHeight + 'px')
        }
        // default action
        query(this.box).find(':scope > div').removeClass('w2ui-sidebar-flat').addClass(this.flat ? 'w2ui-sidebar-flat' : '').css({
            width : query(this.box).get(0).clientWidth + 'px',
            height: query(this.box).get(0).clientHeight + 'px'
        })
        // if no parent - reset nodes
        if (this.nodes.length > 0 && this.nodes[0].parent == null) {
            let tmp    = this.nodes
            this.nodes = []
            this.add(this, tmp)
        }
        let obj = this
        let node
        let nodeSubId
        if (id == null) {
            node = this
            nodeSubId = '.w2ui-sidebar-body'
        } else {
            node = this.get(id)
            if (node == null) return
            nodeSubId = '#node_'+ w2utils.escapeId(node.id) + '_sub'
        }
        let nodeId = '#node_'+ w2utils.escapeId(node.id)
        let nodeHTML
        if (node !== this) {
            nodeHTML = getNodeHTML(node)
            query(this.box).find(nodeId).before('<div id="sidebar_'+ this.name + '_tmp"></div>')
            query(this.box).find(nodeId).remove()
            query(this.box).find(nodeSubId).remove()
            query(this.box).find('#sidebar_'+ this.name + '_tmp').before(nodeHTML)
            query(this.box).find('#sidebar_'+ this.name + '_tmp').remove()
        }
        // remember scroll position
        let div = query(this.box).find(':scope > div').get(0)
        let scroll = {
            top: div.scrollTop,
            left: div.scrollLeft
        }
        // refresh sub nodes
        query(this.box).find(nodeSubId).html('')
        for (let i = 0; i < node.nodes.length; i++) {
            let subNode = node.nodes[i]
            nodeHTML = getNodeHTML(subNode)
            query(this.box).find(nodeSubId).append(nodeHTML)
            if (subNode.nodes.length !== 0) {
                this.refresh(subNode.id, true)
            } else {
                // trigger event
                let edata2 = this.trigger('refresh', {  target: subNode.id })
                if (edata2.isCancelled === true) return
                // event after
                edata2.finish()
            }
        }
        // reset scroll
        div.scrollTop = scroll.top
        div.scrollLeft = scroll.left
        // bind events
        if (!noBinding) {
            let els = query(this.box).find(`${nodeId}.w2ui-eaction, ${nodeSubId} .w2ui-eaction`)
            w2utils.bindEvents(els, this)
        }
        // event after
        edata.finish()
        return (new Date()).getTime() - time
        function getNodeHTML(nd) {
            let html = ''
            let icon = nd.icon
            if (icon == null) icon = obj.icon
            // -- find out level
            let tmp   = nd.parent
            let level = 0
            while (tmp && tmp.parent != null) {
                // if (tmp.group) level--;
                tmp = tmp.parent
                level++
            }
            if (nd.caption != null && nd.text == null) nd.text = nd.caption
            if (nd.caption != null) {
                console.log('NOTICE: sidebar node.caption property is deprecated, please use node.text. Node -> ', nd)
                nd.text = nd.caption
            }
            if (Array.isArray(nd.nodes) && nd.nodes.length > 0) nd.collapsible = true
            if (nd.group) {
                let text = w2utils.lang(typeof nd.text == 'function' ? nd.text.call(obj, nd) : nd.text)
                if (String(text).substr(0, 5) != '<span') {
                    text = `<span class="w2ui-group-text">${text}</span>`
                }
                html = `
                    <div id="node_${nd.id}" data-level="${level}" style="${nd.hidden ? 'display: none' : ''}"
                        class="w2ui-node-group w2ui-level-${level} ${nd.class ? nd.class : ''} w2ui-eaction"
                        data-click="toggle|${nd.id}"
                        data-contextmenu="contextMenu|${nd.id}|event"
                        data-mouseenter="showPlus|this|inherit"
                        data-mouseleave="showPlus|this|transparent">
                        ${nd.groupShowHide && nd.collapsible
                            ? `<span>${!nd.hidden && nd.expanded ? w2utils.lang('Hide') : w2utils.lang('Show')}</span>`
                            : '<span></span>'
                        } ${text}
                    </div>
                    <div class="w2ui-node-sub" id="node_${nd.id}_sub" style="${nd.style}; ${!nd.hidden && nd.expanded ? '' : 'display: none;'}">
                </div>`
                if (obj.flat) {
                    html = `
                        <div class="w2ui-node-group" id="node_${nd.id}"><span>&#160;</span></div>
                        <div id="node_${nd.id}_sub" style="${nd.style}; ${!nd.hidden && nd.expanded ? '' : 'display: none;'}"></div>`
                }
            } else {
                if (nd.selected && !nd.disabled) obj.selected = nd.id
                tmp = ''
                if (icon) {
                    tmp = `
                    <div class="w2ui-node-image">
                        <span class="${typeof icon == 'function' ? icon.call(obj, nd) : icon}"></span>
                    </div>`
                }
                let expand = ''
                let counts = (nd.count != null
                    ? `<div class="w2ui-node-count ${obj.last.badge[nd.id] ? obj.last.badge[nd.id].className || '' : ''}"
                            style="${obj.last.badge[nd.id] ? obj.last.badge[nd.id].style || '' : ''}">
                                ${nd.count}
                       </div>`
                    : '')
                if (nd.collapsible === true) {
                    expand = `<div class="w2ui-${nd.expanded ? 'expanded' : 'collapsed'}"><span></span></div>`
                }
                let text = w2utils.lang(typeof nd.text == 'function' ? nd.text.call(obj, nd) : nd.text)
                // array with classes
                let classes = ['w2ui-node', `w2ui-level-${level}`, 'w2ui-eaction']
                if (nd.selected) classes.push('w2ui-selected')
                if (nd.disabled) classes.push('w2ui-disabled')
                if (nd.class) classes.push(nd.class)
                html = `
                    <div id="node_${nd.id}" class="${classes.join(' ')}" data-level="${level}"
                        style="position: relative; ${nd.hidden ? 'display: none;' : ''}"
                        data-click="click|${nd.id}|event"
                        data-dblclick="dblClick|${nd.id}|event"
                        data-contextmenu="contextMenu|${nd.id}|event">
                        ${obj.handle.html
                            ? `<div class="w2ui-node-handle" style="width: ${obj.handle.size}px; ${obj.handle.style}">
                                   ${typeof obj.handle.html == 'function' ? obj.handle.html.call(obj, nd) : obj.handle.html}
                              </div>`
                            : ''
                        }
                      <div class="w2ui-node-data" style="margin-left: ${level * obj.levelPadding + obj.handle.size}px">
                            ${expand} ${tmp} ${counts}
                            <div class="w2ui-node-text w2ui-node-caption" style="${nd.style || ''}">${text}</div>
                       </div>
                    </div>
                    <div class="w2ui-node-sub" id="node_${nd.id}_sub" style="${nd.style}; ${!nd.hidden && nd.expanded ? '' : 'display: none;'}"></div>`
                if (obj.flat) {
                    let tooltip = w2utils.base64encode(text + (nd.count || nd.count === 0 ? ' - <span class="w2ui-node-count">'+ nd.count +'</span>' : ''))
                    html = `
                        <div id="node_${nd.id}" class="${classes.join(' ')}" style="${nd.hidden ? 'display: none;' : ''}"
                            data-click="click|${nd.id}|event"
                            data-dblclick="dblClick|${nd.id}|event"
                            data-contextmenu="contextMenu|${nd.id}|event"
                            data-mouseenter="tooltip|this|${tooltip}|${nd.id}"
                            data-mouseleave="tooltip|this|">
                            <div class="w2ui-node-data w2ui-node-flat">${tmp}</div>
                        </div>
                        <div class="w2ui-node-sub" id="node_${nd.id}_sub" style="${nd.style}; ${!nd.hidden && nd.expanded ? '' : 'display: none;'}"></div>`
                }
            }
            return html
        }
    }
    tooltip(el, text, id) {
        let $el = query(el).find('.w2ui-node-data')
        if (text !== '') {
            w2tooltip.show({
                anchor: $el.get(0),
                name: this.name + '_tooltip',
                html: w2utils.base64decode(text),
                position: 'right|left'
            })
        } else {
            w2tooltip.hide(this.name + '_tooltip')
        }
    }
    showPlus(el, color) {
        query(el).find('span:nth-child(1)').css('color', color)
    }
    resize() {
        let time = (new Date()).getTime()
        // event before
        let edata = this.trigger('resize', { target: this.name })
        if (edata.isCancelled === true) return
        // default action
        let rect = query(this.box).get(0).getBoundingClientRect()
        query(this.box).css('overflow', 'hidden') // container should have no overflow
        query(this.box).find(':scope > div').css({
            width  : rect.width + 'px',
            height : rect.height + 'px'
        })
        // event after
        edata.finish()
        return (new Date()).getTime() - time
    }
    destroy() {
        // event before
        let edata = this.trigger('destroy', { target: this.name })
        if (edata.isCancelled === true) return
        // clean up
        if (query(this.box).find('.w2ui-sidebar-body').length > 0) {
            query(this.box)
                .removeAttr('name')
                .removeClass('w2ui-reset w2ui-sidebar')
                .html('')
        }
        this.last.resizeObserver?.disconnect()
        delete w2ui[this.name]
        // event after
        edata.finish()
    }
    lock(msg, showSpinner) {
        let args = Array.from(arguments)
        args.unshift(this.box)
        w2utils.lock(...args)
    }
    unlock(speed) {
        w2utils.unlock(this.box, speed)
    }
}
/**
 * Part of w2ui 2.0 library
 *  - Dependencies: mQuery, w2utils, w2base, w2tooltip
 *
 * == 2.0 changes
 *  - CSP - fixed inline events
 *  - removed jQuery dependency
 *  - resizeObserver for the box
 *  - refactored w2events
 *  - scrollIntoView - removed callback
 *  - scroll, scrollIntoView return promise
 *  - animateInsert, animateClose - returns a promise
 *  - add, insert return a promise
 */

class w2tabs extends w2base {
    constructor(options) {
        super(options.name)
        this.box          = null // DOM Element that holds the element
        this.name         = null // unique name for w2ui
        this.active       = null
        this.reorder      = false
        this.flow         = 'down' // can be down or up
        this.tooltip      = 'top|left' // can be top, bottom, left, right
        this.tabs         = []
        this.routeData    = {} // data for dynamic routes
        this.last         = {} // placeholder for internal variables
        this.right        = ''
        this.style        = ''
        this.onClick      = null
        this.onClose      = null
        this.onRender     = null
        this.onRefresh    = null
        this.onResize     = null
        this.onDestroy    = null
        this.tab_template = {
            id: null,
            text: null,
            route: null,
            hidden: false,
            disabled: false,
            closable: false,
            tooltip: null,
            style: '',
            onClick: null,
            onRefresh: null,
            onClose: null
        }
        let tabs = options.tabs
        delete options.tabs
        // mix in options
        Object.assign(this, options)
        // add item via method to makes sure item_template is applied
        if (Array.isArray(tabs)) this.add(tabs)
        // need to reassign back to keep it in config
        options.tabs = tabs
    }
    add(tab) {
        return this.insert(null, tab)
    }
    insert(id, tabs) {
        if (!Array.isArray(tabs)) tabs = [tabs]
        // assume it is array
        let proms = []
        tabs.forEach(tab => {
            // checks
            if (tab.id == null) {
                console.log(`ERROR: The parameter "id" is required but not supplied. (obj: ${this.name})`)
                return
            }
            if (!w2utils.checkUniqueId(tab.id, this.tabs, 'tabs', this.name)) return
            // add tab
            let it = Object.assign({}, this.tab_template, tab)
            if (id == null) {
                this.tabs.push(it)
                proms.push(this.animateInsert(null, it))
            } else {
                let middle = this.get(id, true)
                let before = this.tabs[middle].id
                this.tabs.splice(middle, 0, it)
                proms.push(this.animateInsert(before, it))
            }
        })
        return Promise.all(proms)
    }
    remove() {
        let effected = 0
        Array.from(arguments).forEach(it => {
            let tab = this.get(it)
            if (!tab) return
            effected++
            // remove from array
            this.tabs.splice(this.get(tab.id, true), 1)
            // remove from screen
            query(this.box).find(`#tabs_${this.name}_tab_${w2utils.escapeId(tab.id)}`).remove()
        })
        this.resize()
        return effected
    }
    select(id) {
        if (this.active == id || this.get(id) == null) return false
        this.active = id
        this.refresh()
        return true
    }
    set(id, tab) {
        let index = this.get(id, true)
        if (index == null) return false
        w2utils.extend(this.tabs[index], tab)
        this.refresh(id)
        return true
    }
    get(id, returnIndex) {
        if (arguments.length === 0) {
            let all = []
            for (let i1 = 0; i1 < this.tabs.length; i1++) {
                if (this.tabs[i1].id != null) {
                    all.push(this.tabs[i1].id)
                }
            }
            return all
        } else {
            for (let i2 = 0; i2 < this.tabs.length; i2++) {
                if (this.tabs[i2].id == id) { // need to be == since id can be numeric
                    return (returnIndex === true ? i2 : this.tabs[i2])
                }
            }
        }
        return null
    }
    show() {
        let effected = []
        Array.from(arguments).forEach(it => {
            let tab = this.get(it)
            if (!tab || tab.hidden === false) return
            tab.hidden = false
            effected.push(tab.id)
        })
        setTimeout(() => { effected.forEach(it => { this.refresh(it); this.resize() }) }, 15) // needs timeout
        return effected
    }
    hide() {
        let effected = []
        Array.from(arguments).forEach(it => {
            let tab = this.get(it)
            if (!tab || tab.hidden === true) return
            tab.hidden = true
            effected.push(tab.id)
        })
        setTimeout(() => { effected.forEach(it => { this.refresh(it); this.resize() }) }, 15) // needs timeout
        return effected
    }
    enable() {
        let effected = []
        Array.from(arguments).forEach(it => {
            let tab = this.get(it)
            if (!tab || tab.disabled === false) return
            tab.disabled = false
            effected.push(tab.id)
        })
        setTimeout(() => { effected.forEach(it => { this.refresh(it) }) }, 15) // needs timeout
        return effected
    }
    disable() {
        let effected = []
        Array.from(arguments).forEach(it => {
            let tab = this.get(it)
            if (!tab || tab.disabled === true) return
            tab.disabled = true
            effected.push(tab.id)
        })
        setTimeout(() => { effected.forEach(it => { this.refresh(it) }) }, 15) // needs timeout
        return effected
    }
    dragMove(event) {
        if (!this.last.reordering) return
        let self = this
        let info = this.last.moving
        let tab  = this.tabs[info.index]
        let next = _find(info.index, 1)
        let prev = _find(info.index, -1)
        let $el  = query(this.box).find('#tabs_'+ this.name + '_tab_'+ w2utils.escapeId(tab.id))
        if (info.divX > 0 && next) {
            let $nextEl = query(this.box).find('#tabs_'+ this.name + '_tab_'+ w2utils.escapeId(next.id))
            let width1  = parseInt($el.get(0).clientWidth)
            let width2  = parseInt($nextEl.get(0).clientWidth)
            if (width1 < width2) {
                width1 = Math.floor(width1 / 3)
                width2 = width2 - width1
            } else {
                width1 = Math.floor(width2 / 3)
                width2 = width2 - width1
            }
            if (info.divX > width2) {
                let index = this.tabs.indexOf(next)
                this.tabs.splice(info.index, 0, this.tabs.splice(index, 1)[0]) // reorder in the array
                info.$tab.before($nextEl.get(0))
                info.$tab.css('opacity', 0)
                Object.assign(this.last.moving, {
                    index: index,
                    divX: -width1,
                    x: event.pageX + width1,
                    left: info.left + info.divX + width1
                })
                return
            }
        }
        if (info.divX < 0 && prev) {
            let $prevEl = query(this.box).find('#tabs_'+ this.name + '_tab_'+ w2utils.escapeId(prev.id))
            let width1  = parseInt($el.get(0).clientWidth)
            let width2  = parseInt($prevEl.get(0).clientWidth)
            if (width1 < width2) {
                width1 = Math.floor(width1 / 3)
                width2 = width2 - width1
            } else {
                width1 = Math.floor(width2 / 3)
                width2 = width2 - width1
            }
            if (Math.abs(info.divX) > width2) {
                let index = this.tabs.indexOf(prev)
                this.tabs.splice(info.index, 0, this.tabs.splice(index, 1)[0]) // reorder in the array
                $prevEl.before(info.$tab)
                info.$tab.css('opacity', 0)
                Object.assign(info, {
                    index: index,
                    divX: width1,
                    x: event.pageX - width1,
                    left: info.left + info.divX - width1
                })
                return
            }
        }
        function _find(ind, inc) {
            ind    += inc
            let tab = self.tabs[ind]
            if (tab && tab.hidden) {
                tab = _find(ind, inc)
            }
            return tab
        }
    }
    tooltipShow(id) {
        let item = this.get(id)
        let el = query(this.box).find('#tabs_'+ this.name + '_tab_'+ w2utils.escapeId(id)).get(0)
        if (this.tooltip == null || item.disabled || this.last.reordering) {
            return
        }
        let pos = this.tooltip
        let txt = item.tooltip
        if (typeof txt == 'function') txt = txt.call(this, item)
        w2tooltip.show({
            anchor: el,
            name: this.name + '_tooltip',
            html: txt,
            position: pos
        })
    }
    tooltipHide(id) {
        if (this.tooltip == null) return
        w2tooltip.hide(this.name + '_tooltip')
    }
    getTabHTML(id) {
        let index = this.get(id, true)
        let tab   = this.tabs[index]
        if (tab == null) return false
        if (tab.text == null && tab.caption != null) tab.text = tab.caption
        if (tab.tooltip == null && tab.hint != null) tab.tooltip = tab.hint // for backward compatibility
        if (tab.caption != null) {
            console.log('NOTICE: tabs tab.caption property is deprecated, please use tab.text. Tab -> ', tab)
        }
        if (tab.hint != null) {
            console.log('NOTICE: tabs tab.hint property is deprecated, please use tab.tooltip. Tab -> ', tab)
        }
        let text = tab.text
        if (typeof text == 'function') text = text.call(this, tab)
        if (text == null) text = ''
        let closable = ''
        let addStyle = ''
        if (tab.hidden) { addStyle += 'display: none;' }
        if (tab.disabled) { addStyle += 'opacity: 0.2;' }
        if (tab.closable && !tab.disabled) {
            closable = `<div class="w2ui-tab-close w2ui-eaction ${this.active === tab.id ? 'active' : ''}"
                data-mouseenter='["tooltipShow", "${tab.id}"]'
                data-mouseleave='["tooltipHide", "${tab.id}"]'
                data-mousedown="stop"
                data-mouseup='["clickClose", "${tab.id}", "event"]'>
            </div>`
        }
        return `
            <div id="tabs_${this.name}_tab_${tab.id}" style="${addStyle} ${tab.style}"
               class="w2ui-tab w2ui-eaction ${this.active === tab.id ? 'active' : ''} ${tab.closable ? 'closable' : ''} ${tab.class ? tab.class : ''}"
               data-mouseenter ='["tooltipShow", "${tab.id}"]'
               data-mouseleave ='["tooltipHide", "${tab.id}"]'
               data-mousedown  ='["initReorder", "${tab.id}", "event"]'
               data-click      ='["click", "${tab.id}", "event"]'
               >
                    ${w2utils.lang(text) + closable}
            </div>`
    }
    refresh(id) {
        let time = (new Date()).getTime()
        if (this.flow == 'up') {
            query(this.box).addClass('w2ui-tabs-up')
         } else {
            query(this.box).removeClass('w2ui-tabs-up')
         }
        // event before
        let edata = this.trigger('refresh', { target: (id != null ? id : this.name), object: this.get(id) })
        if (edata.isCancelled === true) return
        if (id == null) {
            // refresh all
            for (let i = 0; i < this.tabs.length; i++) {
                this.refresh(this.tabs[i].id)
            }
        } else {
            // create or refresh only one item
            let selector = '#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(id)
            let $tab = query(this.box).find(selector)
            let tabHTML = this.getTabHTML(id)
            if ($tab.length === 0) {
                query(this.box).find('#tabs_'+ this.name +'_right').before(tabHTML)
            } else {
                if (query(this.box).find('.tab-animate-insert').length == 0) {
                    $tab.replace(tabHTML)
                }
            }
            w2utils.bindEvents(query(this.box).find(`${selector}, ${selector} .w2ui-eaction`), this)
        }
        // right html
        query(this.box).find('#tabs_'+ this.name +'_right').html(this.right)
        // event after
        edata.finish()
        // this.resize();
        return (new Date()).getTime() - time
    }
    render(box) {
        let time = (new Date()).getTime()
        // event before
        let edata = this.trigger('render', { target: this.name, box: box })
        if (edata.isCancelled === true) return
        // default action
        // if (window.getSelection) window.getSelection().removeAllRanges(); // clear selection
        if (box != null) {
            if (query(this.box).find('#tabs_'+ this.name + '_right').length > 0) {
                query(this.box)
                    .removeAttr('name')
                    .removeClass('w2ui-reset w2ui-tabs')
                    .html('')
            }
            this.box = box
        }
        if (!this.box) return false
        // render all buttons
        let html =`
            <div class="w2ui-tabs-line"></div>
            <div class="w2ui-scroll-wrapper w2ui-eaction" data-mousedown="resize">
                <div id="tabs_${this.name}_right" class="w2ui-tabs-right">${this.right}</div>
            </div>
            <div class="w2ui-scroll-left w2ui-eaction" data-click='["scroll","left"]'></div>
            <div class="w2ui-scroll-right w2ui-eaction" data-click='["scroll","right"]'></div>`
        query(this.box)
            .attr('name', this.name)
            .addClass('w2ui-reset w2ui-tabs')
            .html(html)
        if (query(this.box).length > 0) {
            query(this.box)[0].style.cssText += this.style
        }
        w2utils.bindEvents(query(this.box).find('.w2ui-eaction'), this)
        // observe div resize
        this.last.resizeObserver = new ResizeObserver(() => { this.resize() })
        this.last.resizeObserver.observe(this.box)
        // event after
        edata.finish()
        this.refresh()
        this.resize()
        return (new Date()).getTime() - time
    }
    initReorder(id, event) {
        if (!this.reorder) return
        let self     = this
        let $tab     = query(this.box).find('#tabs_' + this.name + '_tab_' + w2utils.escapeId(id))
        let tabIndex = this.get(id, true)
        let $ghost   = query($tab.get(0).cloneNode(true))
        let edata
        $ghost.attr('id', '#tabs_' + this.name + '_tab_ghost')
        this.last.moving = {
            index: tabIndex,
            indexFrom: tabIndex,
            $tab: $tab,
            $ghost: $ghost,
            divX: 0,
            left: $tab.get(0).getBoundingClientRect().left,
            parentX: query(this.box).get(0).getBoundingClientRect().left,
            x: event.pageX,
            opacity: $tab.css('opacity')
        }
        query(document)
            .off('.w2uiTabReorder')
            .on('mousemove.w2uiTabReorder', function (event) {
                if (!self.last.reordering) {
                    // event before
                    edata = self.trigger('reorder', { target: self.tabs[tabIndex].id, indexFrom: tabIndex, tab: self.tabs[tabIndex] })
                    if (edata.isCancelled === true) return
                    w2tooltip.hide(this.name + '_tooltip')
                    self.last.reordering = true
                    $ghost.addClass('moving')
                    $ghost.css({
                        'pointer-events': 'none',
                        'position': 'absolute',
                        'left': $tab.get(0).getBoundingClientRect().left
                    })
                    $tab.css('opacity', 0)
                    query(self.box).find('.w2ui-scroll-wrapper').append($ghost.get(0))
                    query(self.box).find('.w2ui-tab-close').hide()
                }
                self.last.moving.divX = event.pageX - self.last.moving.x
                $ghost.css('left', (self.last.moving.left - self.last.moving.parentX + self.last.moving.divX) + 'px')
                self.dragMove(event)
            })
            .on('mouseup.w2uiTabReorder', function () {
                query(document).off('.w2uiTabReorder')
                $ghost.css({
                    'transition': '0.1s',
                    'left': self.last.moving.$tab.get(0).getBoundingClientRect().left - self.last.moving.parentX
                })
                query(self.box).find('.w2ui-tab-close').show()
                setTimeout(() => {
                    $ghost.remove()
                    $tab.css({ opacity: self.last.moving.opacity })
                    // self.render()
                    if (self.last.reordering) {
                        edata.finish({ indexTo: self.last.moving.index })
                    }
                    self.last.reordering = false
                }, 100)
            })
    }
    scroll(direction, instant) {
        return new Promise((resolve, reject) => {
            let scrollBox  = query(this.box).find(`.w2ui-scroll-wrapper`)
            let scrollLeft = scrollBox.get(0).scrollLeft
            let right      = scrollBox.find('.w2ui-tabs-right').get(0)
            let width1     = scrollBox.parent().get(0).getBoundingClientRect().width
            let width2     = scrollLeft + parseInt(right.offsetLeft) + parseInt(right.clientWidth )
            switch (direction) {
                case 'left': {
                    let scroll = scrollLeft - width1 + 50 // 35 is width of both button
                    if (scroll <= 0) scroll = 0
                    scrollBox.get(0).scrollTo({ top: 0, left: scroll, behavior: instant ? 'atuo' : 'smooth' })
                    break
                }
                case 'right': {
                    let scroll = scrollLeft + width1 - 50 // 35 is width of both button
                    if (scroll >= width2 - width1) scroll = width2 - width1
                    scrollBox.get(0).scrollTo({ top: 0, left: scroll, behavior: instant ? 'atuo' : 'smooth' })
                    break
                }
            }
            setTimeout(() => { this.resize(); resolve() }, instant ? 0 : 350)
        })
    }
    scrollIntoView(id, instant) {
        return new Promise((resolve, reject) => {
            if (id == null) id = this.active
            let tab = this.get(id)
            if (tab == null) return
            let tabEl = query(this.box).find('#tabs_' + this.name + '_tab_' + w2utils.escapeId(id)).get(0)
            tabEl.scrollIntoView({ block: "start", inline: "center", behavior: instant ? 'atuo' : 'smooth' })
            setTimeout(() => { this.resize(); resolve() }, instant ? 0 : 500)
        })
    }
    resize() {
        let time = (new Date()).getTime()
        if (this.box == null) return
        // event before
        let edata = this.trigger('resize', { target: this.name })
        if (edata.isCancelled === true) return
        // show hide overflow buttons
        let box = query(this.box)
        box.find('.w2ui-scroll-left, .w2ui-scroll-right').hide()
        let scrollBox  = box.find('.w2ui-scroll-wrapper').get(0)
        let $right     = box.find('.w2ui-tabs-right')
        let boxWidth   = box.get(0).getBoundingClientRect().width
        let itemsWidth = ($right.length > 0 ? $right[0].offsetLeft + $right[0].clientWidth : 0)
        if (boxWidth < itemsWidth) {
            // we have overflown content
            if (scrollBox.scrollLeft > 0) {
                box.find('.w2ui-scroll-left').show()
            }
            if (boxWidth < itemsWidth - scrollBox.scrollLeft) {
                box.find('.w2ui-scroll-right').show()
            }
        }
        // event after
        edata.finish()
        return (new Date()).getTime() - time
    }
    destroy() {
        // event before
        let edata = this.trigger('destroy', { target: this.name })
        if (edata.isCancelled === true) return
        // clean up
        if (query(this.box).find('#tabs_'+ this.name + '_right').length > 0) {
            query(this.box)
                .removeAttr('name')
                .removeClass('w2ui-reset w2ui-tabs')
                .html('')
        }
        this.last.resizeObserver?.disconnect()
        delete w2ui[this.name]
        // event after
        edata.finish()
    }
    // ===================================================
    // -- Internal Event Handlers
    click(id, event) {
        let tab = this.get(id)
        if (tab == null || tab.disabled || this.last.reordering) return false
        // event before
        let edata = this.trigger('click', { target: id, tab: tab, object: tab, originalEvent: event })
        if (edata.isCancelled === true) return
        // default action
        query(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(this.active)).removeClass('active')
        query(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(this.active)).removeClass('active')
        this.active = tab.id
        // route processing
        if (typeof tab.route == 'string') {
            let route = tab.route !== '' ? String('/'+ tab.route).replace(/\/{2,}/g, '/') : ''
            let info  = w2utils.parseRoute(route)
            if (info.keys.length > 0) {
                for (let k = 0; k < info.keys.length; k++) {
                    if (this.routeData[info.keys[k].name] == null) continue
                    route = route.replace((new RegExp(':'+ info.keys[k].name, 'g')), this.routeData[info.keys[k].name])
                }
            }
            setTimeout(() => { window.location.hash = route }, 1)
        }
        // event after
        edata.finish()
        this.refresh(id)
    }
    clickClose(id, event) {
        let tab = this.get(id)
        if (tab == null || tab.disabled) return false
        // event before
        let edata = this.trigger('close', { target: id, object: this.get(id), originalEvent: event })
        if (edata.isCancelled === true) return
        this.animateClose(id).then(() => {
            this.remove(id)
            edata.finish()
            this.refresh()
        })
        if (event) event.stopPropagation()
    }
    animateClose(id) {
        return new Promise((resolve, reject) => {
            let $tab  = query(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(id))
            let width = parseInt($tab.get(0).clientWidth || 0)
            let anim = `<div class="tab-animate-close" style="display: inline-block; flex-shrink: 0; width: ${width}px; transition: width 0.25s"></div>`
            let $anim = $tab.replace(anim)
            setTimeout(() => { $anim.css({ width: '0px' }) }, 1)
            setTimeout(() => {
                $anim.remove()
                this.resize()
                resolve()
            }, 500)
        })
    }
    animateInsert(id, tab) {
        return new Promise((resolve, reject) => {
            let $before = query(this.box).find('#tabs_'+ this.name +'_tab_'+ w2utils.escapeId(id))
            let $tab    = query.html(this.getTabHTML(tab.id))
            if ($before.length == 0) {
                $before = query(this.box).find('#tabs_tabs_right')
                $before.before($tab)
                this.resize()
            } else {
                $tab.css({ opacity: 0 })
                // first insert tab on the right to get its proper dimentions
                query(this.box).find('#tabs_tabs_right').before($tab.get(0))
                let $tmp  = query(this.box).find('#' + $tab.attr('id'))
                let width = $tmp.get(0).clientWidth ?? 0
                // insert animation div
                let $anim = query.html('<div class="tab-animate-insert" style="flex-shrink: 0; width: 0; transition: width 0.25s"></div>')
                $before.before($anim)
                // hide tab and move it in the right position
                $tab.hide()
                $anim.before($tab[0])
                setTimeout(() => { $anim.css({ width: width + 'px' }) }, 1)
                setTimeout(() => {
                    $anim.remove()
                    $tab.css({ opacity: 1 }).show()
                    this.refresh(tab.id)
                    this.resize()
                    resolve()
                }, 500)
            }
        })
    }
}
/**
 * Part of w2ui 2.0 library
 *  - Dependencies: mQuery, w2utils, w2base, w2tabs, w2toolbar
 *
 * == 2.0 changes
 *  - CSP - fixed inline events
 *  - remove jQuery dependency
 *  - layout.confirm - refactored
 *  - layout.message - refactored
 */

let w2panels = ['top', 'left', 'main', 'preview', 'right', 'bottom']
class w2layout extends w2base {
    constructor(options) {
        super(options.name)
        this.box            = null // DOM Element that holds the element
        this.name           = null // unique name for w2ui
        this.panels         = []
        this.last           = {}
        this.padding        = 1 // panel padding
        this.resizer        = 4 // resizer width or height
        this.style          = ''
        this.onShow         = null
        this.onHide         = null
        this.onResizing     = null
        this.onResizerClick = null
        this.onRender       = null
        this.onRefresh      = null
        this.onChange       = null
        this.onResize       = null
        this.onDestroy      = null
        this.panel_template = {
            type: null, // left, right, top, bottom
            title: '',
            size: 100, // width or height depending on panel name
            minSize: 20,
            maxSize: false,
            hidden: false,
            resizable: false,
            overflow: 'auto',
            style: '',
            html: '', // can be String or Object with .render(box) method
            tabs: null,
            toolbar: null,
            width: null, // read only
            height: null, // read only
            show: {
                toolbar: false,
                tabs: false
            },
            removed: null, // function to call when content is overwritten
            onRefresh: null,
            onShow: null,
            onHide: null
        }
        // mix in options
        Object.assign(this, options)
        if (!Array.isArray(this.panels)) this.panels = []
        // add defined panels
        this.panels.forEach((panel, ind) => {
            this.panels[ind] = w2utils.extend({}, this.panel_template, panel)
            if (w2utils.isPlainObject(panel.tabs) || Array.isArray(panel.tabs)) initTabs(this, panel.type)
            if (w2utils.isPlainObject(panel.toolbar) || Array.isArray(panel.toolbar)) initToolbar(this, panel.type)
        })
        // add all other panels
        w2panels.forEach(tab => {
            if (this.get(tab) != null) return
            this.panels.push(w2utils.extend({}, this.panel_template, { type: tab, hidden: (tab !== 'main'), size: 50 }))
        })
        function initTabs(object, panel, tabs) {
            let pan = object.get(panel)
            if (pan != null && tabs == null) tabs = pan.tabs
            if (pan == null || tabs == null) return false
            // instantiate tabs
            if (Array.isArray(tabs)) tabs = { tabs: tabs }
            let name = object.name + '_' + panel + '_tabs'
            if (w2ui[name]) w2ui[name].destroy() // destroy if existed
            pan.tabs      = new w2tabs(w2utils.extend({}, tabs, { owner: object, name: object.name + '_' + panel + '_tabs' }))
            pan.show.tabs = true
            return true
        }
        function initToolbar(object, panel, toolbar) {
            let pan = object.get(panel)
            if (pan != null && toolbar == null) toolbar = pan.toolbar
            if (pan == null || toolbar == null) return false
            // instantiate toolbar
            if (Array.isArray(toolbar)) toolbar = { items: toolbar }
            let name = object.name + '_' + panel + '_toolbar'
            if (w2ui[name]) w2ui[name].destroy() // destroy if existed
            pan.toolbar      = new w2toolbar(w2utils.extend({}, toolbar, { owner: object, name: object.name + '_' + panel + '_toolbar' }))
            pan.show.toolbar = true
            return true
        }
    }
    html(panel, data, transition) {
        let p = this.get(panel)
        let promise = {
            panel: panel,
            html: p.html,
            error: false,
            cancelled: false,
            removed(cb) {
                if (typeof cb == 'function') {
                    p.removed = cb
                }
            }
        }
        if (typeof p.removed == 'function') {
            p.removed({ panel: panel, html: p.html, html_new: data, transition: transition || 'none' })
            p.removed = null // this is one time call back only
        }
        // if it is CSS panel
        if (panel == 'css') {
            query(this.box).find('#layout_'+ this.name +'_panel_css').html('<style>'+ data +'</style>')
            promise.status = true
            return promise
        }
        if (p == null) {
            console.log('ERROR: incorrect panel name. Panel name can be main, left, right, top, bottom, preview or css')
            promise.error = true
            return promise
        }
        if (data == null) {
            return promise
        }
        // event before
        let edata = this.trigger('change', { target: panel, panel: p, html_new: data, transition: transition })
        if (edata.isCancelled === true) {
            promise.cancelled = true
            return promise
        }
        let pname = '#layout_'+ this.name + '_panel_'+ p.type
        let current = query(this.box).find(pname + '> .w2ui-panel-content')
        let panelTop = 0
        if (current.length > 0) {
            query(this.box).find(pname).get(0).scrollTop = 0
            panelTop = query(current).css('top')
        }
        if (p.html === '') {
            p.html = data
            this.refresh(panel)
        } else {
            p.html = data
            if (!p.hidden) {
                if (transition != null && transition !== '') {
                    // apply transition
                    query(this.box).addClass('animating')
                    let div1 = query(this.box).find(pname + '> .w2ui-panel-content')
                    div1.after('<div class="w2ui-panel-content new-panel" style="'+ div1[0].style.cssText +'"></div>')
                    let div2 = query(this.box).find(pname + '> .w2ui-panel-content.new-panel')
                    div1.css('top', panelTop)
                    div2.css('top', panelTop)
                    if (typeof data == 'object') {
                        data.box = div2[0] // do not do .render(box);
                        data.render()
                    } else {
                        div2.hide().html(data)
                    }
                    w2utils.transition(div1[0], div2[0], transition, () => {
                        div1.remove()
                        div2.removeClass('new-panel')
                        div2.css('overflow', p.overflow)
                        // make sure only one content left
                        query(query(this.box).find(pname + '> .w2ui-panel-content').get(1)).remove()
                        query(this.box).removeClass('animating')
                        this.refresh(panel)
                    })
                } else {
                    this.refresh(panel)
                }
            }
        }
        // event after
        edata.finish()
        return promise
    }
    message(panel, options) {
        let p = this.get(panel)
        let box = query(this.box).find('#layout_'+ this.name + '_panel_'+ p.type)
        let oldOverflow = box.css('overflow')
        box.css('overflow', 'hidden')
        let prom = w2utils.message.call(this, {
            box   : box,
            after : '.w2ui-panel-title',
            param : panel
        }, options)
        prom.self.on('close:after', () => {
            box.css('overflow', oldOverflow)
        })
        return prom
    }
    confirm(panel, options) {
        let p = this.get(panel)
        let box = query(this.box).find('#layout_'+ this.name + '_panel_'+ p.type)
        let oldOverflow = box.css('overflow')
        box.css('overflow', 'hidden')
        let prom = w2utils.confirm.call(this, {
            box   : box,
            after : '.w2ui-panel-title',
            param : panel
        }, options)
        prom.self.on('close:after', () => {
            box.css('overflow', oldOverflow)
        })
        return prom
    }
    load(panel, url, transition) {
        return new Promise((resolve, reject) => {
            if ((panel == 'css' || this.get(panel) != null) && url != null) {
                fetch(url)
                    .then(resp => resp.text())
                    .then(text => {
                        this.resize()
                        resolve(this.html(panel, text, transition))
                    })
            } else {
                reject()
            }
        })
    }
    sizeTo(panel, size, instant) {
        let pan = this.get(panel)
        if (pan == null) return false
        // resize
        query(this.box).find(':scope > div > .w2ui-panel')
            .css('transition', (instant !== true ? '.2s' : '0s'))
        setTimeout(() => { this.set(panel, { size: size }) }, 1)
        // clean
        setTimeout(() => {
            query(this.box).find(':scope > div > .w2ui-panel').css('transition', '0s')
            this.resize()
        }, 300)
        return true
    }
    show(panel, immediate) {
        // event before
        let edata = this.trigger('show', { target: panel, thisect: this.get(panel), immediate: immediate })
        if (edata.isCancelled === true) return
        let p = this.get(panel)
        if (p == null) return false
        p.hidden = false
        if (immediate === true) {
            query(this.box).find('#layout_'+ this.name +'_panel_'+panel)
                .css({ 'opacity': '1' })
            edata.finish()
            this.resize()
        } else {
            // resize
            query(this.box).addClass('animating')
            query(this.box).find('#layout_'+ this.name +'_panel_'+panel)
                .css({ 'opacity': '0' })
            query(this.box).find(':scope > div > .w2ui-panel')
                .css('transition', '.2s')
            setTimeout(() => { this.resize() }, 1)
            // show
            setTimeout(() => {
                query(this.box).find('#layout_'+ this.name +'_panel_'+ panel).css({ 'opacity': '1' })
            }, 250)
            // clean
            setTimeout(() => {
                query(this.box).find(':scope > div > .w2ui-panel')
                    .css('transition', '0s')
                query(this.box).removeClass('animating')
                edata.finish()
                this.resize()
            }, 300)
        }
        return true
    }
    hide(panel, immediate) {
        // event before
        let edata = this.trigger('hide', { target: panel, object: this.get(panel), immediate: immediate })
        if (edata.isCancelled === true) return
        let p = this.get(panel)
        if (p == null) return false
        p.hidden = true
        if (immediate === true) {
            query(this.box).find('#layout_'+ this.name +'_panel_'+panel)
                .css({ 'opacity': '0' })
            edata.finish()
            this.resize()
        } else {
            // hide
            query(this.box).addClass('animating')
            query(this.box).find(':scope > div > .w2ui-panel')
                .css('transition', '.2s')
            query(this.box).find('#layout_'+ this.name +'_panel_'+panel)
                .css({ 'opacity': '0' })
            setTimeout(() => { this.resize() }, 1)
            // clean
            setTimeout(() => {
                query(this.box).find(':scope > div > .w2ui-panel')
                    .css('transition', '0s')
                query(this.box).removeClass('animating')
                edata.finish()
                this.resize()
            }, 300)
        }
        return true
    }
    toggle(panel, immediate) {
        let p = this.get(panel)
        if (p == null) return false
        if (p.hidden) return this.show(panel, immediate); else return this.hide(panel, immediate)
    }
    set(panel, options) {
        let ind = this.get(panel, true)
        if (ind == null) return false
        w2utils.extend(this.panels[ind], options)
        // refresh only when content changed
        if (options.html != null || options.resizable != null) {
            this.refresh(panel)
        }
        // show/hide resizer
        this.resize() // resize is needed when panel size is changed
        return true
    }
    get(panel, returnIndex) {
        for (let p = 0; p < this.panels.length; p++) {
            if (this.panels[p].type == panel) {
                if (returnIndex === true) return p; else return this.panels[p]
            }
        }
        return null
    }
    el(panel) {
        let el = query(this.box).find('#layout_'+ this.name +'_panel_'+ panel +'> .w2ui-panel-content')
        if (el.length != 1) return null
        return el[0]
    }
    hideToolbar(panel) {
        let pan = this.get(panel)
        if (!pan) return
        pan.show.toolbar = false
        query(this.box).find('#layout_'+ this.name +'_panel_'+ panel +'> .w2ui-panel-toolbar').hide()
        this.resize()
    }
    showToolbar(panel) {
        let pan = this.get(panel)
        if (!pan) return
        pan.show.toolbar = true
        query(this.box).find('#layout_'+ this.name +'_panel_'+ panel +'> .w2ui-panel-toolbar').show()
        this.resize()
    }
    toggleToolbar(panel) {
        let pan = this.get(panel)
        if (!pan) return
        if (pan.show.toolbar) this.hideToolbar(panel); else this.showToolbar(panel)
    }
    assignToolbar(panel, toolbar) {
        if (typeof toolbar == 'string' && w2ui[toolbar] != null) toolbar = w2ui[toolbar]
        let pan = this.get(panel)
        pan.toolbar = toolbar
        let tmp = query(this.box).find(panel +'> .w2ui-panel-toolbar')
        if (pan.toolbar != null) {
            if (tmp.find('[name='+ pan.toolbar.name +']').length === 0) {
                pan.toolbar.render(tmp.get(0))
            } else if (pan.toolbar != null) {
                pan.toolbar.refresh()
            }
            toolbar.owner = this
            this.showToolbar(panel)
            this.refresh(panel)
        } else {
            tmp.html('')
            this.hideToolbar(panel)
        }
    }
    hideTabs(panel) {
        let pan = this.get(panel)
        if (!pan) return
        pan.show.tabs = false
        query(this.box).find('#layout_'+ this.name +'_panel_'+ panel +'> .w2ui-panel-tabs').hide()
        this.resize()
    }
    showTabs(panel) {
        let pan = this.get(panel)
        if (!pan) return
        pan.show.tabs = true
        query(this.box).find('#layout_'+ this.name +'_panel_'+ panel +'> .w2ui-panel-tabs').show()
        this.resize()
    }
    toggleTabs(panel) {
        let pan = this.get(panel)
        if (!pan) return
        if (pan.show.tabs) this.hideTabs(panel); else this.showTabs(panel)
    }
    render(box) {
        let self = this
        // if (window.getSelection) window.getSelection().removeAllRanges(); // clear selection
        let time = (new Date()).getTime()
        // event before
        let edata = this.trigger('render', { target: this.name, box: box })
        if (edata.isCancelled === true) return
        if (box != null) {
            if (query(this.box).find('#layout_'+ this.name +'_panel_main').length > 0) {
                query(this.box)
                    .removeAttr('name')
                    .removeClass('w2ui-layout')
                    .html('')
            }
            this.box = box
        }
        if (!this.box) return false
        query(this.box)
            .attr('name', this.name)
            .addClass('w2ui-layout')
            .html('<div></div>')
        if (query(this.box).length > 0) {
            query(this.box)[0].style.cssText += this.style
        }
        // create all panels
        for (let p1 = 0; p1 < w2panels.length; p1++) {
            let html = '<div id="layout_'+ this.name + '_panel_'+ w2panels[p1] +'" class="w2ui-panel">'+
                        '    <div class="w2ui-panel-title"></div>'+
                        '    <div class="w2ui-panel-tabs"></div>'+
                        '    <div class="w2ui-panel-toolbar"></div>'+
                        '    <div class="w2ui-panel-content"></div>'+
                        '</div>'+
                        '<div id="layout_'+ this.name + '_resizer_'+ w2panels[p1] +'" class="w2ui-resizer"></div>'
            query(this.box).find(':scope > div').append(html)
        }
        query(this.box).find(':scope > div')
            .append('<div id="layout_'+ this.name + '_panel_css" style="position: absolute; top: 10000px;"></div>')
        this.refresh() // if refresh is not called here, the layout will not be available right after initialization
        // observe div resize
        this.last.resizeObserver = new ResizeObserver(() => { this.resize() })
        this.last.resizeObserver.observe(this.box)
        // process event
        edata.finish()
        // re-init events
        setTimeout(() => { // needed this timeout to allow browser to render first if there are tabs or toolbar
            self.last.events = { resizeStart, mouseMove, mouseUp }
            this.resize()
        }, 0)
        return (new Date()).getTime() - time
        function resizeStart(type, evnt) {
            if (!self.box) return
            if (!evnt) evnt = window.event
            query(document)
                .off('mousemove', self.last.events.mouseMove)
                .on('mousemove', self.last.events.mouseMove)
            query(document)
                .off('mouseup', self.last.events.mouseUp)
                .on('mouseup', self.last.events.mouseUp)
            self.last.resize = {
                type    : type,
                x       : evnt.screenX,
                y       : evnt.screenY,
                diff_x  : 0,
                diff_y  : 0,
                value   : 0
            }
            // lock all panels
            w2panels.forEach(panel => {
                let $tmp = query(self.el(panel)).find('.w2ui-lock')
                if ($tmp.length > 0) {
                    $tmp.data('locked', 'yes')
                } else {
                    self.lock(panel, { opacity: 0 })
                }
            })
            let el = query(self.box).find('#layout_'+ self.name +'_resizer_'+ type).get(0)
            if (type == 'left' || type == 'right') {
                self.last.resize.value = parseInt(el.style.left)
            }
            if (type == 'top' || type == 'preview' || type == 'bottom') {
                self.last.resize.value = parseInt(el.style.top)
            }
        }
        function mouseUp(evnt) {
            if (!self.box) return
            if (!evnt) evnt = window.event
            query(document).off('mousemove', self.last.events.mouseMove)
            query(document).off('mouseup', self.last.events.mouseUp)
            if (self.last.resize == null) return
            // unlock all panels
            w2panels.forEach(panel => {
                let $tmp = query(self.el(panel)).find('.w2ui-lock')
                if ($tmp.data('locked') == 'yes') {
                    $tmp.removeData('locked')
                } else {
                    self.unlock(panel)
                }
            })
            // set new size
            if (self.last.diff_x !== 0 || self.last.resize.diff_y !== 0) { // only recalculate if changed
                let ptop    = self.get('top')
                let pbottom = self.get('bottom')
                let panel   = self.get(self.last.resize.type)
                let width   = w2utils.getSize(query(self.box), 'width')
                let height  = w2utils.getSize(query(self.box), 'height')
                let str     = String(panel.size)
                let ns, nd
                switch (self.last.resize.type) {
                    case 'top':
                        ns = parseInt(panel.sizeCalculated) + self.last.resize.diff_y
                        nd = 0
                        break
                    case 'bottom':
                        ns = parseInt(panel.sizeCalculated) - self.last.resize.diff_y
                        nd = 0
                        break
                    case 'preview':
                        ns = parseInt(panel.sizeCalculated) - self.last.resize.diff_y
                        nd = (ptop && !ptop.hidden ? ptop.sizeCalculated : 0) +
                            (pbottom && !pbottom.hidden ? pbottom.sizeCalculated : 0)
                        break
                    case 'left':
                        ns = parseInt(panel.sizeCalculated) + self.last.resize.diff_x
                        nd = 0
                        break
                    case 'right':
                        ns = parseInt(panel.sizeCalculated) - self.last.resize.diff_x
                        nd = 0
                        break
                }
                // set size
                if (str.substr(str.length-1) == '%') {
                    panel.size = Math.floor(ns * 100 / (panel.type == 'left' || panel.type == 'right' ? width : height - nd) * 100) / 100 + '%'
                } else {
                    if (String(panel.size).substr(0, 1) == '-') {
                        panel.size = parseInt(panel.size) - panel.sizeCalculated + ns
                    } else {
                        panel.size = ns
                    }
                }
                self.resize()
            }
            query(self.box)
                .find('#layout_'+ self.name + '_resizer_'+ self.last.resize.type)
                .removeClass('active')
            delete self.last.resize
        }
        function mouseMove(evnt) {
            if (!self.box) return
            if (!evnt) evnt = window.event
            if (self.last.resize == null) return
            let panel = self.get(self.last.resize.type)
            // event before
            let tmp   = self.last.resize
            let edata = self.trigger('resizing', { target: self.name, object: panel, originalEvent: evnt,
                panel: tmp ? tmp.type : 'all', diff_x: tmp ? tmp.diff_x : 0, diff_y: tmp ? tmp.diff_y : 0 })
            if (edata.isCancelled === true) return
            let p         = query(self.box).find('#layout_'+ self.name + '_resizer_'+ tmp.type)
            let resize_x  = (evnt.screenX - tmp.x)
            let resize_y  = (evnt.screenY - tmp.y)
            let mainPanel = self.get('main')
            if (!p.hasClass('active')) p.addClass('active')
            switch (tmp.type) {
                case 'left':
                    if (panel.minSize - resize_x > panel.width) {
                        resize_x = panel.minSize - panel.width
                    }
                    if (panel.maxSize && (panel.width + resize_x > panel.maxSize)) {
                        resize_x = panel.maxSize - panel.width
                    }
                    if (mainPanel.minSize + resize_x > mainPanel.width) {
                        resize_x = mainPanel.width - mainPanel.minSize
                    }
                    break
                case 'right':
                    if (panel.minSize + resize_x > panel.width) {
                        resize_x = panel.width - panel.minSize
                    }
                    if (panel.maxSize && (panel.width - resize_x > panel.maxSize)) {
                        resize_x = panel.width - panel.maxSize
                    }
                    if (mainPanel.minSize - resize_x > mainPanel.width) {
                        resize_x = mainPanel.minSize - mainPanel.width
                    }
                    break
                case 'top':
                    if (panel.minSize - resize_y > panel.height) {
                        resize_y = panel.minSize - panel.height
                    }
                    if (panel.maxSize && (panel.height + resize_y > panel.maxSize)) {
                        resize_y = panel.maxSize - panel.height
                    }
                    if (mainPanel.minSize + resize_y > mainPanel.height) {
                        resize_y = mainPanel.height - mainPanel.minSize
                    }
                    break
                case 'preview':
                case 'bottom':
                    if (panel.minSize + resize_y > panel.height) {
                        resize_y = panel.height - panel.minSize
                    }
                    if (panel.maxSize && (panel.height - resize_y > panel.maxSize)) {
                        resize_y = panel.height - panel.maxSize
                    }
                    if (mainPanel.minSize - resize_y > mainPanel.height) {
                        resize_y = mainPanel.minSize - mainPanel.height
                    }
                    break
            }
            tmp.diff_x = resize_x
            tmp.diff_y = resize_y
            switch (tmp.type) {
                case 'top':
                case 'preview':
                case 'bottom':
                    tmp.diff_x = 0
                    if (p.length > 0) p[0].style.top = (tmp.value + tmp.diff_y) + 'px'
                    break
                case 'left':
                case 'right':
                    tmp.diff_y = 0
                    if (p.length > 0) p[0].style.left = (tmp.value + tmp.diff_x) + 'px'
                    break
            }
            // event after
            edata.finish()
        }
    }
    refresh(panel) {
        let self = this
        // if (window.getSelection) window.getSelection().removeAllRanges(); // clear selection
        if (panel == null) panel = null
        let time = (new Date()).getTime()
        // event before
        let edata = self.trigger('refresh', { target: (panel != null ? panel : self.name), object: self.get(panel) })
        if (edata.isCancelled === true) return
        // self.unlock(panel);
        if (typeof panel == 'string') {
            let p = self.get(panel)
            if (p == null) return
            let pname = '#layout_'+ self.name + '_panel_'+ p.type
            let rname = '#layout_'+ self.name +'_resizer_'+ p.type
            // apply properties to the panel
            query(self.box).find(pname).css({ display: p.hidden ? 'none' : 'block' })
            if (p.resizable) {
                query(self.box).find(rname).show()
            } else {
                query(self.box).find(rname).hide()
            }
            // insert content
            if (typeof p.html == 'object' && typeof p.html.render === 'function') {
                p.html.box = query(self.box).find(pname +'> .w2ui-panel-content')[0]
                setTimeout(() => {
                    // need to remove unnecessary classes
                    if (query(self.box).find(pname +'> .w2ui-panel-content').length > 0) {
                        query(self.box).find(pname +'> .w2ui-panel-content')
                            .removeClass()
                            .removeAttr('name')
                            .addClass('w2ui-panel-content')
                            .css('overflow', p.overflow)[0].style.cssText += ';' + p.style
                    }
                    if (p.html && typeof p.html.render == 'function') {
                        p.html.render() // do not do .render(box);
                    }
                }, 1)
            } else {
                // need to remove unnecessary classes
                if (query(self.box).find(pname +'> .w2ui-panel-content').length > 0) {
                    query(self.box).find(pname +'> .w2ui-panel-content')
                        .removeClass()
                        .removeAttr('name')
                        .addClass('w2ui-panel-content')
                        .html(p.html)
                        .css('overflow', p.overflow)[0].style.cssText += ';' + p.style
                }
            }
            // if there are tabs and/or toolbar - render it
            let tmp = query(self.box).find(pname +'> .w2ui-panel-tabs')
            if (p.show.tabs) {
                if (tmp.find('[name='+ p.tabs.name +']').length === 0 && p.tabs != null) {
                    p.tabs.render(tmp.get(0))
                } else {
                    p.tabs.refresh()
                }
            } else {
                tmp.html('').removeClass('w2ui-tabs').hide()
            }
            tmp = query(self.box).find(pname +'> .w2ui-panel-toolbar')
            if (p.show.toolbar) {
                if (tmp.find('[name='+ p.toolbar.name +']').length === 0 && p.toolbar != null) {
                    p.toolbar.render(tmp.get(0))
                 } else {
                     p.toolbar.refresh()
                 }
            } else {
                tmp.html('').removeClass('w2ui-toolbar').hide()
            }
            // show title
            tmp = query(self.box).find(pname +'> .w2ui-panel-title')
            if (p.title) {
                tmp.html(p.title).show()
            } else {
                tmp.html('').hide()
            }
        } else {
            if (query(self.box).find('#layout_'+ self.name +'_panel_main').length === 0) {
                self.render()
                return
            }
            self.resize()
            // refresh all of them
            for (let p1 = 0; p1 < this.panels.length; p1++) { self.refresh(this.panels[p1].type) }
        }
        edata.finish()
        return (new Date()).getTime() - time
    }
    resize() {
        // if (window.getSelection) window.getSelection().removeAllRanges();    // clear selection
        if (!this.box) return false
        let time = (new Date()).getTime()
        // event before
        let tmp   = this.last.resize
        let edata = this.trigger('resize', { target: this.name,
            panel: tmp ? tmp.type : 'all', diff_x: tmp ? tmp.diff_x : 0, diff_y: tmp ? tmp.diff_y : 0 })
        if (edata.isCancelled === true) return
        if (this.padding < 0) this.padding = 0
        // layout itself
        let width  = w2utils.getSize(query(this.box), 'width')
        let height = w2utils.getSize(query(this.box), 'height')
        query(this.box).find(':scope > div')
            .css({
                width: width + 'px',
                height: height + 'px'
            })
        let self = this
        // panels
        let pmain   = this.get('main')
        let pprev   = this.get('preview')
        let pleft   = this.get('left')
        let pright  = this.get('right')
        let ptop    = this.get('top')
        let pbottom = this.get('bottom')
        let sprev   = (pprev != null && pprev.hidden !== true ? true : false)
        let sleft   = (pleft != null && pleft.hidden !== true ? true : false)
        let sright  = (pright != null && pright.hidden !== true ? true : false)
        let stop    = (ptop != null && ptop.hidden !== true ? true : false)
        let sbottom = (pbottom != null && pbottom.hidden !== true ? true : false)
        let l, t, w, h
        // calculate %
        for (let p = 0; p < w2panels.length; p++) {
            if (w2panels[p] === 'main') continue
            tmp = this.get(w2panels[p])
            if (!tmp) continue
            let str = String(tmp.size || 0)
            if (str.substr(str.length-1) == '%') {
                let tmph = height
                if (tmp.type == 'preview') {
                    tmph = tmph -
                        (ptop && !ptop.hidden ? ptop.sizeCalculated : 0) -
                        (pbottom && !pbottom.hidden ? pbottom.sizeCalculated : 0)
                }
                tmp.sizeCalculated = parseInt((tmp.type == 'left' || tmp.type == 'right' ? width : tmph) * parseFloat(tmp.size) / 100)
            } else {
                tmp.sizeCalculated = parseInt(tmp.size)
            }
            tmp.sizeCalculated = Math.max(tmp.sizeCalculated, parseInt(tmp.minSize))
        }
        // negative size
        if (String(pright.size).substr(0, 1) == '-') {
            if (sleft && String(pleft.size).substr(0, 1) == '-') {
                console.log('ERROR: you cannot have both left panel.size and right panel.size be negative.')
            } else {
                pright.sizeCalculated = width - (sleft ? pleft.sizeCalculated : 0) + parseInt(pright.size)
            }
        }
        if (String(pleft.size).substr(0, 1) == '-') {
            if (sright && String(pright.size).substr(0, 1) == '-') {
                console.log('ERROR: you cannot have both left panel.size and right panel.size be negative.')
            } else {
                pleft.sizeCalculated = width - (sright ? pright.sizeCalculated : 0) + parseInt(pleft.size)
            }
        }
        // top if any
        if (ptop != null && ptop.hidden !== true) {
            l = 0
            t = 0
            w = width
            h = ptop.sizeCalculated
            query(this.box).find('#layout_'+ this.name +'_panel_top')
                .css({
                    'display': 'block',
                    'left': l + 'px',
                    'top': t + 'px',
                    'width': w + 'px',
                    'height': h + 'px'
                })
            ptop.width  = w
            ptop.height = h
            // resizer
            if (ptop.resizable) {
                t = ptop.sizeCalculated - (this.padding === 0 ? this.resizer : 0)
                h = (this.resizer > this.padding ? this.resizer : this.padding)
                query(this.box).find('#layout_'+ this.name +'_resizer_top')
                    .css({
                        'display': 'block',
                        'left': l + 'px',
                        'top': t + 'px',
                        'width': w + 'px',
                        'height': h + 'px',
                        'cursor': 'ns-resize'
                    })
                    .off('mousedown')
                    .on('mousedown', function(event) {
                        // event before
                        let edata = self.trigger('resizerClick', { target: 'top', originalEvent: event })
                        if (edata.isCancelled === true) return
                        // default action
                        w2ui[self.name].last.events.resizeStart('top', event)
                        // event after
                        edata.finish()
                        return false
                    })
            }
        } else {
            query(this.box).find('#layout_'+ this.name +'_panel_top').hide()
            query(this.box).find('#layout_'+ this.name +'_resizer_top').hide()
        }
        // left if any
        if (pleft != null && pleft.hidden !== true) {
            l = 0
            t = 0 + (stop ? ptop.sizeCalculated + this.padding : 0)
            w = pleft.sizeCalculated
            h = height - (stop ? ptop.sizeCalculated + this.padding : 0) -
                    (sbottom ? pbottom.sizeCalculated + this.padding : 0)
            query(this.box).find('#layout_'+ this.name +'_panel_left')
                .css({
                    'display': 'block',
                    'left': l + 'px',
                    'top': t + 'px',
                    'width': w + 'px',
                    'height': h + 'px'
                })
            pleft.width  = w
            pleft.height = h
            // resizer
            if (pleft.resizable) {
                l = pleft.sizeCalculated - (this.padding === 0 ? this.resizer : 0)
                w = (this.resizer > this.padding ? this.resizer : this.padding)
                query(this.box).find('#layout_'+ this.name +'_resizer_left')
                    .css({
                        'display': 'block',
                        'left': l + 'px',
                        'top': t + 'px',
                        'width': w + 'px',
                        'height': h + 'px',
                        'cursor': 'ew-resize'
                    })
                    .off('mousedown')
                    .on('mousedown', function(event) {
                        // event before
                        let edata = self.trigger('resizerClick', { target: 'left', originalEvent: event })
                        if (edata.isCancelled === true) return
                        // default action
                        w2ui[self.name].last.events.resizeStart('left', event)
                        // event after
                        edata.finish()
                        return false
                    })
            }
        } else {
            query(this.box).find('#layout_'+ this.name +'_panel_left').hide()
            query(this.box).find('#layout_'+ this.name +'_resizer_left').hide()
        }
        // right if any
        if (pright != null && pright.hidden !== true) {
            l = width - pright.sizeCalculated
            t = 0 + (stop ? ptop.sizeCalculated + this.padding : 0)
            w = pright.sizeCalculated
            h = height - (stop ? ptop.sizeCalculated + this.padding : 0) -
                (sbottom ? pbottom.sizeCalculated + this.padding : 0)
            query(this.box).find('#layout_'+ this.name +'_panel_right')
                .css({
                    'display': 'block',
                    'left': l + 'px',
                    'top': t + 'px',
                    'width': w + 'px',
                    'height': h + 'px'
                })
            pright.width  = w
            pright.height = h
            // resizer
            if (pright.resizable) {
                l = l - this.padding
                w = (this.resizer > this.padding ? this.resizer : this.padding)
                query(this.box).find('#layout_'+ this.name +'_resizer_right')
                    .css({
                        'display': 'block',
                        'left': l + 'px',
                        'top': t + 'px',
                        'width': w + 'px',
                        'height': h + 'px',
                        'cursor': 'ew-resize'
                    })
                    .off('mousedown')
                    .on('mousedown', function(event) {
                        // event before
                        let edata = self.trigger('resizerClick', { target: 'right', originalEvent: event })
                        if (edata.isCancelled === true) return
                        // default action
                        w2ui[self.name].last.events.resizeStart('right', event)
                        // event after
                        edata.finish()
                        return false
                    })
            }
        } else {
            query(this.box).find('#layout_'+ this.name +'_panel_right').hide()
            query(this.box).find('#layout_'+ this.name +'_resizer_right').hide()
        }
        // bottom if any
        if (pbottom != null && pbottom.hidden !== true) {
            l = 0
            t = height - pbottom.sizeCalculated
            w = width
            h = pbottom.sizeCalculated
            query(this.box).find('#layout_'+ this.name +'_panel_bottom')
                .css({
                    'display': 'block',
                    'left': l + 'px',
                    'top': t + 'px',
                    'width': w + 'px',
                    'height': h + 'px'
                })
            pbottom.width  = w
            pbottom.height = h
            // resizer
            if (pbottom.resizable) {
                t = t - (this.padding === 0 ? 0 : this.padding)
                h = (this.resizer > this.padding ? this.resizer : this.padding)
                query(this.box).find('#layout_'+ this.name +'_resizer_bottom')
                    .css({
                        'display': 'block',
                        'left': l + 'px',
                        'top': t + 'px',
                        'width': w + 'px',
                        'height': h + 'px',
                        'cursor': 'ns-resize'
                    })
                    .off('mousedown')
                    .on('mousedown', function(event) {
                        // event before
                        let edata = self.trigger('resizerClick', { target: 'bottom', originalEvent: event })
                        if (edata.isCancelled === true) return
                        // default action
                        w2ui[self.name].last.events.resizeStart('bottom', event)
                        // event after
                        edata.finish()
                        return false
                    })
            }
        } else {
            query(this.box).find('#layout_'+ this.name +'_panel_bottom').hide()
            query(this.box).find('#layout_'+ this.name +'_resizer_bottom').hide()
        }
        // main - always there
        l = 0 + (sleft ? pleft.sizeCalculated + this.padding : 0)
        t = 0 + (stop ? ptop.sizeCalculated + this.padding : 0)
        w = width - (sleft ? pleft.sizeCalculated + this.padding : 0) -
            (sright ? pright.sizeCalculated + this.padding: 0)
        h = height - (stop ? ptop.sizeCalculated + this.padding : 0) -
            (sbottom ? pbottom.sizeCalculated + this.padding : 0) -
            (sprev ? pprev.sizeCalculated + this.padding : 0)
        query(this.box)
            .find('#layout_'+ this.name +'_panel_main')
            .css({
                'display': 'block',
                'left': l + 'px',
                'top': t + 'px',
                'width': w + 'px',
                'height': h + 'px'
            })
        pmain.width  = w
        pmain.height = h
        // preview if any
        if (pprev != null && pprev.hidden !== true) {
            l = 0 + (sleft ? pleft.sizeCalculated + this.padding : 0)
            t = height - (sbottom ? pbottom.sizeCalculated + this.padding : 0) - pprev.sizeCalculated
            w = width - (sleft ? pleft.sizeCalculated + this.padding : 0) -
                (sright ? pright.sizeCalculated + this.padding : 0)
            h = pprev.sizeCalculated
            query(this.box).find('#layout_'+ this.name +'_panel_preview')
                .css({
                    'display': 'block',
                    'left': l + 'px',
                    'top': t + 'px',
                    'width': w + 'px',
                    'height': h + 'px'
                })
            pprev.width  = w
            pprev.height = h
            // resizer
            if (pprev.resizable) {
                t = t - (this.padding === 0 ? 0 : this.padding)
                h = (this.resizer > this.padding ? this.resizer : this.padding)
                query(this.box).find('#layout_'+ this.name +'_resizer_preview')
                    .css({
                        'display': 'block',
                        'left': l + 'px',
                        'top': t + 'px',
                        'width': w + 'px',
                        'height': h + 'px',
                        'cursor': 'ns-resize'
                    })
                    .off('mousedown')
                    .on('mousedown', function(event) {
                        // event before
                        let edata = self.trigger('resizerClick', { target: 'preview', originalEvent: event })
                        if (edata.isCancelled === true) return
                        // default action
                        w2ui[self.name].last.events.resizeStart('preview', event)
                        // event after
                        edata.finish()
                        return false
                    })
            }
        } else {
            query(this.box).find('#layout_'+ this.name +'_panel_preview').hide()
            query(this.box).find('#layout_'+ this.name +'_resizer_preview').hide()
        }
        // display tabs and toolbar if needed
        for (let p1 = 0; p1 < w2panels.length; p1++) {
            let pan = this.get(w2panels[p1])
            let tmp2 = '#layout_'+ this.name +'_panel_'+ w2panels[p1] +' > .w2ui-panel-'
            let tabHeight = 0
            if (pan) {
                if (pan.title) {
                    let el = query(this.box).find(tmp2 + 'title').css({ top: tabHeight + 'px', display: 'block' })
                    tabHeight += w2utils.getSize(el, 'height')
                }
                if (pan.show.tabs) {
                    let el = query(this.box).find(tmp2 + 'tabs').css({ top: tabHeight + 'px', display: 'block' })
                    tabHeight += w2utils.getSize(el, 'height')
                }
                if (pan.show.toolbar) {
                    let el = query(this.box).find(tmp2 + 'toolbar').css({ top: tabHeight + 'px', display: 'block' })
                    tabHeight += w2utils.getSize(el, 'height')
                }
            }
            query(this.box).find(tmp2 + 'content').css({ display: 'block' }).css({ top: tabHeight + 'px' })
        }
        edata.finish()
        return (new Date()).getTime() - time
    }
    destroy() {
        // event before
        let edata = this.trigger('destroy', { target: this.name })
        if (edata.isCancelled === true) return
        if (w2ui[this.name] == null) return false
        // clean up
        if (query(this.box).find('#layout_'+ this.name +'_panel_main').length > 0) {
            query(this.box)
                .removeAttr('name')
                .removeClass('w2ui-layout')
                .html('')
        }
        this.last.resizeObserver?.disconnect()
        delete w2ui[this.name]
        // event after
        edata.finish()
        if (this.last.events && this.last.events.resize) {
            query(window).off('resize', this.last.events.resize)
        }
        return true
    }
    lock(panel, msg, showSpinner) {
        if (w2panels.indexOf(panel) == -1) {
            console.log('ERROR: First parameter needs to be the a valid panel name.')
            return
        }
        let args = Array.from(arguments)
        args[0]  = '#layout_'+ this.name + '_panel_' + panel
        w2utils.lock(...args)
    }
    unlock(panel, speed) {
        if (w2panels.indexOf(panel) == -1) {
            console.log('ERROR: First parameter needs to be the a valid panel name.')
            return
        }
        let nm = '#layout_'+ this.name + '_panel_' + panel
        w2utils.unlock(nm, speed)
    }
}
/**
 * Part of w2ui 2.0 library
 *  - Dependencies: jQuery, w2utils, w2base, w2toolbar, w2field
 *
 * == TODO ==
 *  - problem with .set() and arrays, array get extended too, but should be replaced
 *  - after edit stay on the same record option
 *  - if supplied array of ids, get should return array of records
 *  - allow functions in routeData (also add routeData to list/enum)
 *  - send parsed URL to the event if there is routeData
 *  - if you set searchData or sortData and call refresh() it should work
 *  - add selectType: 'none' so that no selection can be make but with mouse
 *  - focus/blur for selectType = cell not display grayed out selection
 *  - frozen columns
 *  - scrolling on frozen columns is not working only on regular columns
 *  - copy or large number of records is slow
 *  - reusable search component (see https://github.com/vitmalina/w2ui/issues/914#issuecomment-107340524)
 *  - allow enum in inline edit (see https://github.com/vitmalina/w2ui/issues/911#issuecomment-107341193)
 *  - if record has no recid, then it should be index in the array (should not be 0)
 *  - remote source, but localSort/localSearch
 *  - right click on columns
 *  - reload a single records (useful when need to update deep in buffered records)
 *  - need to update PHP example
 *  - return structure status -> replace with success
 *  - msg* - should be in prototype
 *  - search fields not finised
 *  - row reorder not finished
 *  - expendable grids are still working
 *  - moved a lot of properties into prototype
 *  - promise for request, load, save, etc.
 *  - remote date local sort/search
 *  - colDefaults -> col_template as in tabs, toolbar, etc
 *  - prepareData needs help page
 *  - separate columnRefresh, recordsRefresh, fullRefresh
 *  - onloadmore event (so it will be easy to implement remote data source with local sort)
 *  - avoid inline events, but allow w2ui-eaction
 *  - status() - clears on next select, etc. Should not if it is off
 *  - edit demo grid/21 - if you hit add record too fast, it breaks
 *  - refactor onSelect/onUselect - should be one event, when selection changes
 *  - saveSearches - save not working right
 *
 * == DEMOS To create ==
 *  - batch for disabled buttons
 *  - naturla sort
 *  - resize on max content
 *  - context message
 *  - clipboard copy
 *  - save searches, custom searches
 *
 * == KNOWN ISSUES ==
 *  - reorder records with school - not correct
 *  - reorder columns not working
 *  - bug: vs_start = 100 and more then 500 records, when scrolling empty sets
 *  - Shift-click/Ctrl-click/Ctrl-Shift-Click selection is not as robust as it should be
 *  - refactor reorderRow (not finished)
 *
 * == 2.0 changes
 *  - toolbarInput - deprecated, toolbarSearch stays
 *  - searchSuggest
 *  - searchSave, searchSelected, savedSearches, useLocalStorage, searchFieldDrop
 *  - onSearchSave, onSearchRemove, onSearchSelect
 *  - show.searchLogic
 *  - show.searchSave
 *  - refreshSearch
 *  - initAllFields -> searchInitInput
 *  - textSearch - deprecated in favor of defaultOperator
 *  - grid.confirm - refactored
 *  - grid.message - refactored
 *  - search.type == 'text' can have 'in' and 'not in' operators, then it will switch to enum
 *  - grid.find(..., displayedOnly)
 *  - column.render(..., this) - added
 *  - resizeObserver for the box
 */

class w2grid extends w2base {
    constructor(options) {
        super(options.name)
        this.name         = null
        this.box          = null // HTML element that hold this element
        this.columns      = [] // { field, text, size, attr, render, hidden, gridMinWidth, editable }
        this.columnGroups = [] // { span: int, text: 'string', main: true/false }
        this.records      = [] // { recid: int(required), field1: 'value1', ... fieldN: 'valueN', style: 'string',  changes: object }
        this.summary      = [] // array of summary records, same structure as records array
        this.searches     = [] // { type, label, field, inTag, outTag, hidden }
        this.toolbar      = {} // if not empty object; then it is toolbar object
        this.ranges       = []
        this.menu         = []
        this.searchMap    = {} // re-map search fields
        this.searchData   = []
        this.sortMap      = {} // re-map sort fields
        this.sortData     = []
        this.savedSearches= []
        this.total        = 0 // server total
        this.recid        = null // field from records to be used as recid
        // internal
        this.last = {
            field     : '',         // last search field, e.g. 'all'
            label     : '',         // last search field label, e.g. 'All Fields'
            logic     : 'AND',      // last search logic, e.g. 'AND' or 'OR'
            search    : '',         // last search text
            searchIds : [],         // last search IDs
            selection : {           // last selection details
                indexes : [],
                columns : {}
            },
            _selection  : null,     // last result of selectionSave()
            multi       : false,    // last multi flag, true when searching for multiple fields
            scrollTop   : 0,        // last scrollTop position
            scrollLeft  : 0,        // last scrollLeft position
            colStart    : 0,        // for column virtual scrolling
            colEnd      : 0,        // for column virtual scrolling
            xhr         : null,     // last jquery xhr requests
            xhr_cmd     : '',       // last xhr command, e.g. 'get'
            xhr_offset  : null,     // last xhr offset, integer
            xhr_start   : 0,        // timestamp of start of last xhr request
            xhr_response: 0,        // time it took to complete the last xhr request in seconds
            xhr_hasMore : false,    // flag to indicate if there are more items to pull from the server
            pull_more   : false,
            pull_refresh: true,
            loaded      : false,    // loaded state of grid
            range_start : null,     // last range start cell
            range_end   : null,     // last range end cell
            sel_ind     : null,     // last selected cell index
            sel_col     : null,     // last selected column
            sel_type    : null,     // last selection type, e.g. 'click' or 'key'
            sel_recid   : null,     // last selected record id
            idCache     : {},       // object, id cache for get()
            move        : null,     // object, move details
            cancelClick : null,     // boolean flag to indicate if the click event should be ignored, set during mouseMove()
            inEditMode  : false,    // flag to indicate if we're currently in edit mode during inline editing
            _edit       : null,     // object with details on the last edited cell, { value, index, column, recid }
            kbd_timer   : null,     // last id of blur() timer
            marker_timer: null,     // last id of markSearch() timer
            click_time  : null,     // timestamp of last click
            click_recid : null,     // last clicked record id
            bubbleEl    : null,     // last bubble element
            colResizing : false,    // flag to indicate that a column is currently being resized
            tmp         : null,     // object with last column resizing details
            copy_event  : null,     // last copy event
            userSelect  : '',       // last user select type, e.g. 'text'
            columnDrag  : false,    // false or an object with a remove() method
            state       : null,     // last grid state
            show_extra  : 0,        // last show extra for virtual scrolling
            _toolbar_height: 0,     // height of grid's toolbar
        }
        this.header            = ''
        this.url               = ''
        this.limit             = 100
        this.offset            = 0 // how many records to skip (for infinite scroll) when pulling from server
        this.postData          = {}
        this.routeData         = {}
        this.httpHeaders       = {}
        this.show              = {
            header          : false,
            toolbar         : false,
            footer          : false,
            columnHeaders   : true,
            lineNumbers     : false,
            orderColumn     : false,
            expandColumn    : false,
            selectColumn    : false,
            emptyRecords    : true,
            toolbarReload   : true,
            toolbarColumns  : false,
            toolbarSearch   : true,
            toolbarAdd      : false,
            toolbarEdit     : false,
            toolbarDelete   : false,
            toolbarSave     : false,
            searchAll       : true,
            searchLogic     : true,
            searchHiddenMsg : false,
            searchSave      : true,
            statusRange     : true,
            statusBuffered  : false,
            statusRecordID  : true,
            statusSelection : true,
            statusResponse  : true,
            statusSort      : false,
            statusSearch    : false,
            recordTitles    : false,
            selectionBorder : true,
            skipRecords     : true,
            saveRestoreState: true
        }
        this.stateId           = null // Custom state name for stateSave, stateRestore and stateReset
        this.hasFocus          = false
        this.autoLoad          = true // for infinite scroll
        this.fixedBody         = true // if false; then grid grows with data
        this.recordHeight      = 32
        this.lineNumberWidth   = 34
        this.keyboard          = true
        this.selectType        = 'row' // can be row|cell
        this.multiSearch       = true
        this.multiSelect       = true
        this.multiSort         = true
        this.reorderColumns    = false
        this.reorderRows       = false
        this.showExtraOnSearch = 0 // show extra records before and after on search
        this.markSearch        = true
        this.columnTooltip     = 'top|bottom' // can be top, bottom, left, right
        this.disableCVS        = false // disable Column Virtual Scroll
        this.nestedFields      = true // use field name containing dots as separator to look into object
        this.vs_start          = 150
        this.vs_extra          = 15
        this.style             = ''
        this.tabIndex          = null
        this.method            = null // if defined, then overwrites ajax method
        this.dataType          = null // if defined, then overwrites w2utils.settings.dataType
        this.parser            = null
        this.advanceOnEdit     = true // automatically begin editing the next cell after submitting an inline edit?
        this.useLocalStorage   = true
        // default values for the column
        this.colDefaults = {
            text           : '',    // column text (can be a function)
            field          : '',    // field name to map the column to a record
            size           : null,  // size of column in px or %
            min            : 20,    // minimum width of column in px
            max            : null,  // maximum width of column in px
            gridMinWidth   : null,  // minimum width of the grid when column is visible
            sizeCorrected  : null,  // read only, corrected size (see explanation below)
            sizeCalculated : null,  // read only, size in px (see explanation below)
            sizeOriginal   : null,  // size as defined
            sizeType       : null,  // px or %
            hidden         : false, // indicates if column is hidden
            sortable       : false, // indicates if column is sortable
            sortMode       : null,  // sort mode ('default'|'natural'|'i18n') or custom compare function
            searchable     : false, // bool/string: int,float,date,... or an object to create search field
            resizable      : true,  // indicates if column is resizable
            hideable       : true,  // indicates if column can be hidden
            autoResize     : null,  // indicates if column can be auto-resized by double clicking on the resizer
            attr           : '',    // string that will be inside the <td ... attr> tag
            style          : '',    // additional style for the td tag
            render         : null,  // string or render function
            title          : null,  // string or function for the title property for the column cells
            tooltip        : null,  // string for the title property for the column header
            editable       : {},    // editable object (see explanation below)
            frozen         : false, // indicates if the column is fixed to the left
            info           : null,  // info bubble, can be bool/object
            clipboardCopy  : false, // if true (or string or function), it will display clipboard copy icon
        }
        // these column properties will be saved in stateSave()
        this.stateColProps = {
            text            : false,
            field           : true,
            size            : true,
            min             : false,
            max             : false,
            gridMinWidth    : false,
            sizeCorrected   : false,
            sizeCalculated  : true,
            sizeOriginal    : true,
            sizeType        : true,
            hidden          : true,
            sortable        : false,
            sortMode        : true,
            searchable      : false,
            resizable       : false,
            hideable        : false,
            autoResize      : false,
            attr            : false,
            style           : false,
            render          : false,
            title           : false,
            tooltip         : false,
            editable        : false,
            frozen          : true,
            info            : false,
            clipboardCopy   : false
        }
        this.msgDelete     = 'Are you sure you want to delete ${count} ${records}?'
        this.msgNotJSON    = 'Returned data is not in valid JSON format.'
        this.msgAJAXerror  = 'AJAX error. See console for more details.'
        this.msgRefresh    = 'Refreshing...'
        this.msgNeedReload = 'Your remote data source record count has changed, reloading from the first record.'
        this.msgEmpty      = '' // if not blank, then it is message when server returns no records
        this.buttons = {
            'reload'   : { type: 'button', id: 'w2ui-reload', icon: 'w2ui-icon-reload', tooltip: 'Reload data in the list' },
            'columns'  : { type: 'menu-check', id: 'w2ui-column-on-off', icon: 'w2ui-icon-columns', tooltip: 'Show/hide columns',
                overlay: { align: 'none' }
            },
            'search'   : { type: 'html', id: 'w2ui-search',
                html: '<div class="w2ui-icon w2ui-icon-search w2ui-search-down" '+
                      'onclick="let grid = w2ui[jQuery(this).parents(\'div.w2ui-grid\').attr(\'name\')]; grid.searchShowFields()"></div>'
            },
            'add'      : { type: 'button', id: 'w2ui-add', text: 'Add New', tooltip: 'Add new record', icon: 'w2ui-icon-plus' },
            'edit'     : { type: 'button', id: 'w2ui-edit', text: 'Edit', tooltip: 'Edit selected record', icon: 'w2ui-icon-pencil', batch: 1, disabled: true },
            'delete'   : { type: 'button', id: 'w2ui-delete', text: 'Delete', tooltip: 'Delete selected records', icon: 'w2ui-icon-cross', batch: true, disabled: true },
            'save'     : { type: 'button', id: 'w2ui-save', text: 'Save', tooltip: 'Save changed records', icon: 'w2ui-icon-check' }
        }
        this.operators = { // for search fields
            'text'    : ['is', 'begins', 'contains', 'ends'], // could have "in" and "not in"
            'number'  : ['=', 'between', '>', '<', '>=', '<='],
            'date'    : ['is', 'between', { oper: 'less', text: 'before'}, { oper: 'more', text: 'after' }],
            'list'    : ['is'],
            'hex'     : ['is', 'between'],
            'color'   : ['is', 'begins', 'contains', 'ends'],
            'enum'    : ['in', 'not in']
            // -- all possible
            // "text"    : ['is', 'begins', 'contains', 'ends'],
            // "number"  : ['is', 'between', 'less:less than', 'more:more than', 'null:is null', 'not null:is not null'],
            // "list"    : ['is', 'null:is null', 'not null:is not null'],
            // "enum"    : ['in', 'not in', 'null:is null', 'not null:is not null']
        }
        this.defaultOperator = {
            'text'    : 'begins',
            'number'  : '=',
            'date'    : 'is',
            'list'    : 'is',
            'enum'    : 'in',
            'hex'     : 'begins',
            'color'   : 'begins'
        }
        // map search field type to operator
        this.operatorsMap = {
            'text'         : 'text',
            'int'          : 'number',
            'float'        : 'number',
            'money'        : 'number',
            'currency'     : 'number',
            'percent'      : 'number',
            'hex'          : 'hex',
            'alphanumeric' : 'text',
            'color'        : 'color',
            'date'         : 'date',
            'time'         : 'date',
            'datetime'     : 'date',
            'list'         : 'list',
            'combo'        : 'text',
            'enum'         : 'enum',
            'file'         : 'enum',
            'select'       : 'list',
            'radio'        : 'list',
            'checkbox'     : 'list',
            'toggle'       : 'list'
        }
        // events
        this.onAdd              = null
        this.onEdit             = null
        this.onRequest          = null // called on any server event
        this.onLoad             = null
        this.onDelete           = null
        this.onSave             = null
        this.onSelect           = null
        this.onUnselect         = null
        this.onClick            = null
        this.onDblClick         = null
        this.onContextMenu      = null
        this.onMenuClick        = null // when context menu item selected
        this.onColumnClick      = null
        this.onColumnDblClick   = null
        this.onColumnResize     = null
        this.onColumnAutoResize = null
        this.onSort             = null
        this.onSearch           = null
        this.onSearchOpen       = null
        this.onChange           = null // called when editable record is changed
        this.onRestore          = null // called when editable record is restored
        this.onExpand           = null
        this.onCollapse         = null
        this.onError            = null
        this.onKeydown          = null
        this.onToolbar          = null // all events from toolbar
        this.onColumnOnOff      = null
        this.onCopy             = null
        this.onPaste            = null
        this.onSelectionExtend  = null
        this.onEditField        = null
        this.onRender           = null
        this.onRefresh          = null
        this.onReload           = null
        this.onResize           = null
        this.onDestroy          = null
        this.onStateSave        = null
        this.onStateRestore     = null
        this.onFocus            = null
        this.onBlur             = null
        this.onReorderRow       = null
        this.onSearchSave       = null
        this.onSearchRemove     = null
        this.onSearchSelect     = null
        this.onColumnSelect     = null
        this.onColumnDragStart  = null
        this.onColumnDragEnd    = null
        this.onResizerDblClick  = null
        // need deep merge, should be extend, not objectAssign
        w2utils.extend(this, options)
        // check if there are records without recid
        if (Array.isArray(this.records)) {
            let remove = [] // remove from records as they are summary
            this.records.forEach((rec, ind) => {
                if (rec[this.recid] != null) {
                    rec.recid = rec[this.recid]
                }
                if (rec.recid == null) {
                    console.log('ERROR: Cannot add records without recid. (obj: '+ this.name +')')
                }
                if (rec.w2ui && rec.w2ui.summary === true) {
                    this.summary.push(rec)
                    remove.push(ind) // cannot remove here as it will mess up array walk thru
                }
            })
            remove.sort()
            for (let t = remove.length-1; t >= 0; t--) {
                this.records.splice(remove[t], 1)
            }
        }
        // add searches
        if (Array.isArray(this.columns)) {
            this.columns.forEach((col, ind) => {
                col = $.extend({}, this.colDefaults, col)
                this.columns[ind] = col
                let search = col.searchable
                if (search == null || search === false || this.getSearch(col.field) != null) return
                if ($.isPlainObject(search)) {
                    this.addSearch($.extend({ field: col.field, label: col.text, type: 'text' }, search))
                } else {
                    let stype = col.searchable
                    let attr  = ''
                    if (col.searchable === true) {
                        stype = 'text'
                        attr  = 'size="20"'
                    }
                    this.addSearch({ field: col.field, label: col.text, type: stype, attr: attr })
                }
            })
        }
        // check if there are saved searches in localStorage
        if (w2utils.hasLocalStorage && this.useLocalStorage) {
            try {
                let tmp = JSON.parse(localStorage.w2ui || '{}')
                if (tmp && tmp.searches) {
                    let saved = tmp.searches[this.stateId || this.name]
                    if (Array.isArray(saved)) {
                        saved.forEach(search => {
                            this.savedSearches.push({
                                id: search.name,
                                text: search.name,
                                icon: 'w2ui-icon-search',
                                remove: true,
                                logic: search.logic,
                                data: search.data
                            })
                        })
                    }
                }
            } catch (e) {
            }
        }
    }
    add(record, first) {
        if (!Array.isArray(record)) record = [record]
        let added = 0
        for (let i = 0; i < record.length; i++) {
            let rec = record[i]
            if (rec[this.recid] != null) {
                rec.recid = rec[this.recid]
            }
            if (rec.recid == null) {
                console.log('ERROR: Cannot add record without recid. (obj: '+ this.name +')')
                continue
            }
            if (rec.w2ui && rec.w2ui.summary === true) {
                if (first) this.summary.unshift(rec); else this.summary.push(rec)
            } else {
                if (first) this.records.unshift(rec); else this.records.push(rec)
            }
            added++
        }
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if (!url) {
            this.total = this.records.length
            this.localSort(false, true)
            this.localSearch()
            // do not call this.refresh(), this is unnecessary, heavy, and messes with the toolbar.
            // this.refreshBody()
            // this.resizeRecords()
            this.refresh()
        } else {
            this.refresh() // ??  should it be reload?
        }
        return added
    }
    find(obj, returnIndex, displayedOnly) {
        if (obj == null) obj = {}
        let recs    = []
        let hasDots = false
        // check if property is nested - needed for speed
        for (let o in obj) if (String(o).indexOf('.') != -1) hasDots = true
        // look for an item
        let start = displayedOnly ? this.last.range_start : 0
        let end   = displayedOnly ? this.last.range_end + 1: this.records.length
        if (end > this.records.length) end = this.records.length
        for (let i = start; i < end; i++) {
            let match = true
            for (let o in obj) {
                let val = this.records[i][o]
                if (hasDots && String(o).indexOf('.') != -1) val = this.parseField(this.records[i], o)
                if (obj[o] == 'not-null') {
                    if (val == null || val === '') match = false
                } else {
                    if (obj[o] != val) match = false
                }
            }
            if (match && returnIndex !== true) recs.push(this.records[i].recid)
            if (match && returnIndex === true) recs.push(i)
        }
        return recs
    }
    set(recid, record, noRefresh) { // does not delete existing, but overrides on top of it
        if ((typeof recid == 'object') && (recid !== null)) {
            noRefresh = record
            record    = recid
            recid     = null
        }
        // update all records
        if (recid == null) {
            for (let i = 0; i < this.records.length; i++) {
                $.extend(true, this.records[i], record) // recid is the whole record
            }
            if (noRefresh !== true) this.refresh()
        } else { // find record to update
            let ind = this.get(recid, true)
            if (ind == null) return false
            let isSummary = (this.records[ind] && this.records[ind].recid == recid ? false : true)
            if (isSummary) {
                $.extend(true, this.summary[ind], record)
            } else {
                $.extend(true, this.records[ind], record)
            }
            if (noRefresh !== true) this.refreshRow(recid, ind) // refresh only that record
        }
        return true
    }
    get(recid, returnIndex) {
        // search records
        if (Array.isArray(recid)) {
            let recs = []
            for (let i = 0; i < recid.length; i++) {
                let v = this.get(recid[i], returnIndex)
                if (v !== null)
                    recs.push(v)
            }
            return recs
        } else {
            // get() must be fast, implements a cache to bypass loop over all records
            // most of the time.
            let idCache = this.last.idCache
            if (!idCache) {
                this.last.idCache = idCache = {}
            }
            let i = idCache[recid]
            if (typeof(i) === 'number') {
                if (i >= 0 && i < this.records.length && this.records[i].recid == recid) {
                    if (returnIndex === true) return i; else return this.records[i]
                }
                // summary indexes are stored as negative numbers, try them now.
                i = ~i
                if (i >= 0 && i < this.summary.length && this.summary[i].recid == recid) {
                    if (returnIndex === true) return i; else return this.summary[i]
                }
                // wrong index returned, clear cache
                this.last.idCache = idCache = {}
            }
            for (let i = 0; i < this.records.length; i++) {
                if (this.records[i].recid == recid) {
                    idCache[recid] = i
                    if (returnIndex === true) return i; else return this.records[i]
                }
            }
            // search summary
            for (let i = 0; i < this.summary.length; i++) {
                if (this.summary[i].recid == recid) {
                    idCache[recid] = ~i
                    if (returnIndex === true) return i; else return this.summary[i]
                }
            }
            return null
        }
    }
    getFirst(offset) {
        if (this.records.length == 0) return null
        let rec = this.records[0]
        let tmp = this.last.searchIds
        if (this.searchData.length > 0) {
            if (Array.isArray(tmp) && tmp.length > 0) {
                rec = this.records[tmp[offset || 0]]
            } else {
                rec = null
            }
        }
        return rec
    }
    remove() {
        let removed = 0
        for (let a = 0; a < arguments.length; a++) {
            for (let r = this.records.length-1; r >= 0; r--) {
                if (this.records[r].recid == arguments[a]) { this.records.splice(r, 1); removed++ }
            }
            for (let r = this.summary.length-1; r >= 0; r--) {
                if (this.summary[r].recid == arguments[a]) { this.summary.splice(r, 1); removed++ }
            }
        }
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if (!url) {
            this.localSort(false, true)
            this.localSearch()
        }
        this.refresh()
        return removed
    }
    addColumn(before, columns) {
        let added = 0
        if (arguments.length == 1) {
            columns = before
            before  = this.columns.length
        } else {
            if (typeof before == 'string') before = this.getColumn(before, true)
            if (before == null) before = this.columns.length
        }
        if (!Array.isArray(columns)) columns = [columns]
        for (let i = 0; i < columns.length; i++) {
            let col = $.extend({}, this.colDefaults, columns[i])
            this.columns.splice(before, 0, col)
            // if column is searchable, add search field
            if (columns[i].searchable) {
                let stype = columns[i].searchable
                let attr  = ''
                if (columns[i].searchable === true) { stype = 'text'; attr = 'size="20"' }
                this.addSearch({ field: columns[i].field, label: columns[i].label, type: stype, attr: attr })
            }
            before++
            added++
        }
        this.refresh()
        return added
    }
    removeColumn() {
        let removed = 0
        for (let a = 0; a < arguments.length; a++) {
            for (let r = this.columns.length-1; r >= 0; r--) {
                if (this.columns[r].field == arguments[a]) {
                    if (this.columns[r].searchable) this.removeSearch(arguments[a])
                    this.columns.splice(r, 1)
                    removed++
                }
            }
        }
        this.refresh()
        return removed
    }
    getColumn(field, returnIndex) {
        // no arguments - return fields of all columns
        if (arguments.length === 0) {
            let ret = []
            for (let i = 0; i < this.columns.length; i++) ret.push(this.columns[i].field)
            return ret
        }
        // find column
        for (let i = 0; i < this.columns.length; i++) {
            if (this.columns[i].field == field) {
                if (returnIndex === true) return i; else return this.columns[i]
            }
        }
        return null
    }
    updateColumn(fields, updates) {
        let effected = 0
        fields = (Array.isArray(fields) ? fields : [fields])
        fields.forEach((colName) => {
            this.columns.forEach((col) => {
                if (col.field == colName) {
                    let _updates = $.extend(true, {}, updates)
                    Object.keys(_updates).forEach((key) => {
                        // if it is a function
                        if (typeof _updates[key] == 'function') {
                            _updates[key] = _updates[key](col)
                        }
                        if (col[key] != _updates[key]) effected++
                    })
                    $.extend(true, col, _updates)
                }
            })
        })
        if (effected > 0) {
            this.refresh() // need full refresh due to colgroups not reassigning properly
        }
        return effected
    }
    toggleColumn() {
        return this.updateColumn(Array.from(arguments), { hidden(col) { return !col.hidden } })
    }
    showColumn() {
        return this.updateColumn(Array.from(arguments), { hidden: false })
    }
    hideColumn() {
        return this.updateColumn(Array.from(arguments), { hidden: true })
    }
    addSearch(before, search) {
        let added = 0
        if (arguments.length == 1) {
            search = before
            before = this.searches.length
        } else {
            if (typeof before == 'string') before = this.getSearch(before, true)
            if (before == null) before = this.searches.length
        }
        if (!Array.isArray(search)) search = [search]
        for (let i = 0; i < search.length; i++) {
            this.searches.splice(before, 0, search[i])
            before++
            added++
        }
        this.searchClose()
        return added
    }
    removeSearch() {
        let removed = 0
        for (let a = 0; a < arguments.length; a++) {
            for (let r = this.searches.length-1; r >= 0; r--) {
                if (this.searches[r].field == arguments[a]) { this.searches.splice(r, 1); removed++ }
            }
        }
        this.searchClose()
        return removed
    }
    getSearch(field, returnIndex) {
        // no arguments - return fields of all searches
        if (arguments.length === 0) {
            let ret = []
            for (let i = 0; i < this.searches.length; i++) ret.push(this.searches[i].field)
            return ret
        }
        // find search
        for (let i = 0; i < this.searches.length; i++) {
            if (this.searches[i].field == field) {
                if (returnIndex === true) return i; else return this.searches[i]
            }
        }
        return null
    }
    toggleSearch() {
        let effected = 0
        for (let a = 0; a < arguments.length; a++) {
            for (let r = this.searches.length-1; r >= 0; r--) {
                if (this.searches[r].field == arguments[a]) {
                    this.searches[r].hidden = !this.searches[r].hidden
                    effected++
                }
            }
        }
        this.searchClose()
        return effected
    }
    showSearch() {
        let shown = 0
        for (let a = 0; a < arguments.length; a++) {
            for (let r = this.searches.length-1; r >= 0; r--) {
                if (this.searches[r].field == arguments[a] && this.searches[r].hidden !== false) {
                    this.searches[r].hidden = false
                    shown++
                }
            }
        }
        this.searchClose()
        return shown
    }
    hideSearch() {
        let hidden = 0
        for (let a = 0; a < arguments.length; a++) {
            for (let r = this.searches.length-1; r >= 0; r--) {
                if (this.searches[r].field == arguments[a] && this.searches[r].hidden !== true) {
                    this.searches[r].hidden = true
                    hidden++
                }
            }
        }
        this.searchClose()
        return hidden
    }
    getSearchData(field) {
        for (let i = 0; i < this.searchData.length; i++) {
            if (this.searchData[i].field == field) return this.searchData[i]
        }
        return null
    }
    localSort(silent, noResetRefresh) {
        let obj = this
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if (url) {
            console.log('ERROR: grid.localSort can only be used on local data source, grid.url should be empty.')
            return
        }
        if ($.isEmptyObject(this.sortData)) return
        let time = (new Date()).getTime()
        // process date fields
        this.selectionSave()
        this.prepareData()
        if (!noResetRefresh) {
            this.reset()
        }
        // process sortData
        for (let i = 0; i < this.sortData.length; i++) {
            let column = this.getColumn(this.sortData[i].field)
            if (!column) return // TODO: ability to sort columns when they are not part of colums array
            if (typeof column.render == 'string') {
                if (['date', 'age'].indexOf(column.render.split(':')[0]) != -1) {
                    this.sortData[i].field_ = column.field + '_'
                }
                if (['time'].indexOf(column.render.split(':')[0]) != -1) {
                    this.sortData[i].field_ = column.field + '_'
                }
            }
        }
        // prepare paths and process sort
        preparePaths()
        this.records.sort((a, b) => {
            return compareRecordPaths(a, b)
        })
        cleanupPaths()
        this.selectionRestore(noResetRefresh)
        time = (new Date()).getTime() - time
        if (silent !== true && this.show.statusSort) {
            setTimeout(() => {
                this.status(w2utils.lang('Sorting took ${count} seconds', { count: time/1000 }))
            }, 10)
        }
        return time
        // grab paths before sorting for efficiency and because calling obj.get()
        // while sorting 'obj.records' is unsafe, at least on webkit
        function preparePaths() {
            for (let i = 0; i < obj.records.length; i++) {
                let rec = obj.records[i]
                if (rec.w2ui && rec.w2ui.parent_recid != null) {
                    rec.w2ui._path = getRecordPath(rec)
                }
            }
        }
        // cleanup and release memory allocated by preparePaths()
        function cleanupPaths() {
            for (let i = 0; i < obj.records.length; i++) {
                let rec = obj.records[i]
                if (rec.w2ui && rec.w2ui.parent_recid != null) {
                    rec.w2ui._path = null
                }
            }
        }
        // compare two paths, from root of tree to given records
        function compareRecordPaths(a, b) {
            if ((!a.w2ui || a.w2ui.parent_recid == null) && (!b.w2ui || b.w2ui.parent_recid == null)) {
                return compareRecords(a, b) // no tree, fast path
            }
            let pa = getRecordPath(a)
            let pb = getRecordPath(b)
            for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
                let diff = compareRecords(pa[i], pb[i])
                if (diff !== 0) return diff // different subpath
            }
            if (pa.length > pb.length) return 1
            if (pa.length < pb.length) return -1
            console.log('ERROR: two paths should not be equal.')
            return 0
        }
        // return an array of all records from root to and including 'rec'
        function getRecordPath(rec) {
            if (!rec.w2ui || rec.w2ui.parent_recid == null) return [rec]
            if (rec.w2ui._path)
                return rec.w2ui._path
            // during actual sort, we should never reach this point
            let subrec = obj.get(rec.w2ui.parent_recid)
            if (!subrec) {
                console.log('ERROR: no parent record: '+rec.w2ui.parent_recid)
                return [rec]
            }
            return (getRecordPath(subrec).concat(rec))
        }
        // compare two records according to sortData and finally recid
        function compareRecords(a, b) {
            if (a === b) return 0 // optimize, same object
            for (let i = 0; i < obj.sortData.length; i++) {
                let fld     = obj.sortData[i].field
                let sortFld = (obj.sortData[i].field_) ? obj.sortData[i].field_ : fld
                let aa      = a[sortFld]
                let bb      = b[sortFld]
                if (String(fld).indexOf('.') != -1) {
                    aa = obj.parseField(a, sortFld)
                    bb = obj.parseField(b, sortFld)
                }
                let col = obj.getColumn(fld)
                if (col && Object.keys(col.editable).length > 0) { // for drop editable fields and drop downs
                    if ($.isPlainObject(aa) && aa.text) aa = aa.text
                    if ($.isPlainObject(bb) && bb.text) bb = bb.text
                }
                let ret = compareCells(aa, bb, i, obj.sortData[i].direction, col.sortMode || 'default')
                if (ret !== 0) return ret
            }
            // break tie for similar records,
            // required to have consistent ordering for tree paths
            let ret = compareCells(a.recid, b.recid, -1, 'asc')
            return ret
        }
        // compare two values, aa and bb, producing consistent ordering
        function compareCells(aa, bb, i, direction, sortMode) {
            // if both objects are strictly equal, we're done
            if (aa === bb)
                return 0
            // all nulls, empty and undefined on bottom
            if ((aa == null || aa === '') && (bb != null && bb !== ''))
                return 1
            if ((aa != null && aa !== '') && (bb == null || bb === ''))
                return -1
            let dir = (direction.toLowerCase() === 'asc') ? 1 : -1
            // for different kind of objects, sort by object type
            if (typeof aa != typeof bb)
                return (typeof aa > typeof bb) ? dir : -dir
            // for different kind of classes, sort by classes
            if (aa.constructor.name != bb.constructor.name)
                return (aa.constructor.name > bb.constructor.name) ? dir : -dir
            // if we're dealing with non-null objects, call valueOf().
            // this mean that Date() or custom objects will compare properly.
            if (aa && typeof aa == 'object')
                aa = aa.valueOf()
            if (bb && typeof bb == 'object')
                bb = bb.valueOf()
            // if we're still dealing with non-null objects that have
            // a useful Object => String conversion, convert to string.
            let defaultToString = {}.toString
            if (aa && typeof aa == 'object' && aa.toString != defaultToString)
                aa = String(aa)
            if (bb && typeof bb == 'object' && bb.toString != defaultToString)
                bb = String(bb)
            // do case-insensitive string comparison
            if (typeof aa == 'string')
                aa = aa.toLowerCase().trim()
            if (typeof bb == 'string')
                bb = bb.toLowerCase().trim()
            switch (sortMode) {
                case 'natural':
                    sortMode = w2utils.naturalCompare
                    break
                case 'i18n':
                    sortMode = w2utils.i18nCompare
                    break
            }
            if (typeof sortMode == 'function') {
                return sortMode(aa,bb) * dir
            }
            // compare both objects
            if (aa > bb)
                return dir
            if (aa < bb)
                return -dir
            return 0
        }
    }
    localSearch(silent) {
        let obj = this
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if (url) {
            console.log('ERROR: grid.localSearch can only be used on local data source, grid.url should be empty.')
            return
        }
        let time            = (new Date()).getTime()
        let defaultToString = {}.toString
        let duplicateMap    = {}
        this.total          = this.records.length
        // mark all records as shown
        this.last.searchIds = []
        // prepare date/time fields
        this.prepareData()
        // hide records that did not match
        if (this.searchData.length > 0 && !url) {
            this.total = 0
            for (let i = 0; i < this.records.length; i++) {
                let rec   = this.records[i]
                let match = searchRecord(rec)
                if (match) {
                    if (rec && rec.w2ui) addParent(rec.w2ui.parent_recid)
                    if (this.showExtraOnSearch > 0) {
                        let before = this.showExtraOnSearch
                        let after  = this.showExtraOnSearch
                        if (i < before) before = i
                        if (i + after > this.records.length) after = this.records.length - i
                        if (before > 0) {
                            for (let j = i - before; j < i; j++) {
                                if (this.last.searchIds.indexOf(j) < 0)
                                    this.last.searchIds.push(j)
                            }
                        }
                        if (this.last.searchIds.indexOf(i) < 0) this.last.searchIds.push(i)
                        if (after > 0) {
                            for (let j = (i + 1) ; j <= (i + after) ; j++) {
                                if (this.last.searchIds.indexOf(j) < 0) this.last.searchIds.push(j)
                            }
                        }
                    } else {
                        this.last.searchIds.push(i)
                    }
                }
            }
            this.total = this.last.searchIds.length
        }
        time = (new Date()).getTime() - time
        if (silent !== true && this.show.statusSearch) {
            setTimeout(() => {
                this.status(w2utils.lang('Search took ${count} seconds', { count: time/1000 }))
            }, 10)
        }
        return time
        // check if a record (or one of its closed children) matches the search data
        function searchRecord(rec) {
            let fl      = 0, val1, val2, val3, tmp
            let orEqual = false
            for (let j = 0; j < obj.searchData.length; j++) {
                let sdata  = obj.searchData[j]
                let search = obj.getSearch(sdata.field)
                if (sdata == null) continue
                if (search == null) search = { field: sdata.field, type: sdata.type }
                let val1b = obj.parseField(rec, search.field)
                val1      = (val1b !== null && val1b !== undefined &&
                    (typeof val1b != 'object' || val1b.toString != defaultToString)) ?
                    String(val1b).toLowerCase() : '' // do not match a bogus string
                if (sdata.value != null) {
                    if (!Array.isArray(sdata.value)) {
                        val2 = String(sdata.value).toLowerCase()
                    } else {
                        val2 = sdata.value[0]
                        val3 = sdata.value[1]
                    }
                }
                switch (sdata.operator) {
                    case '=':
                    case 'is':
                        if (obj.parseField(rec, search.field) == sdata.value) fl++ // do not hide record
                        else if (search.type == 'date') {
                            tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val1 = w2utils.formatDate(tmp, 'yyyy-mm-dd')
                            val2 = w2utils.formatDate(w2utils.isDate(val2, w2utils.settings.dateFormat, true), 'yyyy-mm-dd')
                            if (val1 == val2) fl++
                        }
                        else if (search.type == 'time') {
                            tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val1 = w2utils.formatTime(tmp, 'hh24:mi')
                            val2 = w2utils.formatTime(val2, 'hh24:mi')
                            if (val1 == val2) fl++
                        }
                        else if (search.type == 'datetime') {
                            tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val1 = w2utils.formatDateTime(tmp, 'yyyy-mm-dd|hh24:mm:ss')
                            val2 = w2utils.formatDateTime(w2utils.isDateTime(val2, w2utils.settings.datetimeFormat, true), 'yyyy-mm-dd|hh24:mm:ss')
                            if (val1 == val2) fl++
                        }
                        break
                    case 'between':
                        if (['int', 'float', 'money', 'currency', 'percent'].indexOf(search.type) != -1) {
                            if (parseFloat(obj.parseField(rec, search.field)) >= parseFloat(val2) && parseFloat(obj.parseField(rec, search.field)) <= parseFloat(val3)) fl++
                        }
                        else if (search.type == 'date') {
                            tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val1 = w2utils.isDate(tmp, w2utils.settings.dateFormat, true)
                            val2 = w2utils.isDate(val2, w2utils.settings.dateFormat, true)
                            val3 = w2utils.isDate(val3, w2utils.settings.dateFormat, true)
                            if (val3 != null) val3 = new Date(val3.getTime() + 86400000) // 1 day
                            if (val1 >= val2 && val1 < val3) fl++
                        }
                        else if (search.type == 'time') {
                            val1 = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val2 = w2utils.isTime(val2, true)
                            val3 = w2utils.isTime(val3, true)
                            val2 = (new Date()).setHours(val2.hours, val2.minutes, val2.seconds ? val2.seconds : 0, 0)
                            val3 = (new Date()).setHours(val3.hours, val3.minutes, val3.seconds ? val3.seconds : 0, 0)
                            if (val1 >= val2 && val1 < val3) fl++
                        }
                        else if (search.type == 'datetime') {
                            val1 = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val2 = w2utils.isDateTime(val2, w2utils.settings.datetimeFormat, true)
                            val3 = w2utils.isDateTime(val3, w2utils.settings.datetimeFormat, true)
                            if (val3) val3 = new Date(val3.getTime() + 86400000) // 1 day
                            if (val1 >= val2 && val1 < val3) fl++
                        }
                        break
                    case '<=':
                        orEqual = true
                    case '<':
                    case 'less':
                        if (['int', 'float', 'money', 'currency', 'percent'].indexOf(search.type) != -1) {
                            val1 = parseFloat(obj.parseField(rec, search.field))
                            val2 = parseFloat(sdata.value)
                            if (val1 < val2 || (orEqual && val1 === val2)) fl++
                        }
                        else if (search.type == 'date') {
                            tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val1 = w2utils.isDate(tmp, w2utils.settings.dateFormat, true)
                            val2 = w2utils.isDate(val2, w2utils.settings.dateFormat, true)
                            if (val1 < val2 || (orEqual && val1 === val2)) fl++
                        }
                        else if (search.type == 'time') {
                            tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val1 = w2utils.formatTime(tmp, 'hh24:mi')
                            val2 = w2utils.formatTime(val2, 'hh24:mi')
                            if (val1 < val2 || (orEqual && val1 === val2)) fl++
                        }
                        else if (search.type == 'datetime') {
                            tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val1 = w2utils.formatDateTime(tmp, 'yyyy-mm-dd|hh24:mm:ss')
                            val2 = w2utils.formatDateTime(w2utils.isDateTime(val2, w2utils.settings.datetimeFormat, true), 'yyyy-mm-dd|hh24:mm:ss')
                            if (val1.length == val2.length && (val1 < val2 || (orEqual && val1 === val2))) fl++
                        }
                        break
                    case '>=':
                        orEqual = true
                    case '>':
                    case 'more':
                        if (['int', 'float', 'money', 'currency', 'percent'].indexOf(search.type) != -1) {
                            val1 = parseFloat(obj.parseField(rec, search.field))
                            val2 = parseFloat(sdata.value)
                            if (val1 > val2 || (orEqual && val1 === val2)) fl++
                        }
                        else if (search.type == 'date') {
                            tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val1 = w2utils.isDate(tmp, w2utils.settings.dateFormat, true)
                            val2 = w2utils.isDate(val2, w2utils.settings.dateFormat, true)
                            if (val1 > val2 || (orEqual && val1 === val2)) fl++
                        }
                        else if (search.type == 'time') {
                            tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val1 = w2utils.formatTime(tmp, 'hh24:mi')
                            val2 = w2utils.formatTime(val2, 'hh24:mi')
                            if (val1 > val2 || (orEqual && val1 === val2)) fl++
                        }
                        else if (search.type == 'datetime') {
                            tmp  = (obj.parseField(rec, search.field + '_') instanceof Date ? obj.parseField(rec, search.field + '_') : obj.parseField(rec, search.field))
                            val1 = w2utils.formatDateTime(tmp, 'yyyy-mm-dd|hh24:mm:ss')
                            val2 = w2utils.formatDateTime(w2utils.isDateTime(val2, w2utils.settings.datetimeFormat, true), 'yyyy-mm-dd|hh24:mm:ss')
                            if (val1.length == val2.length && (val1 > val2 || (orEqual && val1 === val2))) fl++
                        }
                        break
                    case 'in':
                        tmp = sdata.value
                        if (sdata.svalue) tmp = sdata.svalue
                        if ((tmp.indexOf(w2utils.isFloat(val1b) ? parseFloat(val1b) : val1b) !== -1) || tmp.indexOf(val1) !== -1) fl++
                        break
                    case 'not in':
                        tmp = sdata.value
                        if (sdata.svalue) tmp = sdata.svalue
                        if (!((tmp.indexOf(w2utils.isFloat(val1b) ? parseFloat(val1b) : val1b) !== -1) || tmp.indexOf(val1) !== -1)) fl++
                        break
                    case 'begins':
                    case 'begins with': // need for back compatibility
                        if (val1.indexOf(val2) === 0) fl++ // do not hide record
                        break
                    case 'contains':
                        if (val1.indexOf(val2) >= 0) fl++ // do not hide record
                        break
                    case 'null':
                        if (obj.parseField(rec, search.field) == null) fl++ // do not hide record
                        break
                    case 'not null':
                        if (obj.parseField(rec, search.field) != null) fl++ // do not hide record
                        break
                    case 'ends':
                    case 'ends with': // need for back compatibility
                        let lastIndex = val1.lastIndexOf(val2)
                        if (lastIndex !== -1 && lastIndex == val1.length - val2.length) fl++ // do not hide record
                        break
                }
            }
            if ((obj.last.logic == 'OR' && fl !== 0) ||
                (obj.last.logic == 'AND' && fl == obj.searchData.length))
                return true
            if (rec.w2ui && rec.w2ui.children && rec.w2ui.expanded !== true) {
                // there are closed children, search them too.
                for (let r = 0; r < rec.w2ui.children.length; r++) {
                    let subRec = rec.w2ui.children[r]
                    if (searchRecord(subRec))
                        return true
                }
            }
            return false
        }
        // add parents nodes recursively
        function addParent(recid) {
            if (recid === undefined)
                return
            if (duplicateMap[recid])
                return // already visited
            duplicateMap[recid] = true
            let i               = obj.get(recid, true)
            if (i == null)
                return
            if ($.inArray(i, obj.last.searchIds) != -1)
                return
            let rec = obj.records[i]
            if (rec && rec.w2ui)
                addParent(rec.w2ui.parent_recid)
            obj.last.searchIds.push(i)
        }
    }
    getRangeData(range, extra) {
        let rec1 = this.get(range[0].recid, true)
        let rec2 = this.get(range[1].recid, true)
        let col1 = range[0].column
        let col2 = range[1].column
        let res = []
        if (col1 == col2) { // one row
            for (let r = rec1; r <= rec2; r++) {
                let record = this.records[r]
                let dt     = record[this.columns[col1].field] || null
                if (extra !== true) {
                    res.push(dt)
                } else {
                    res.push({ data: dt, column: col1, index: r, record: record })
                }
            }
        } else if (rec1 == rec2) { // one line
            let record = this.records[rec1]
            for (let i = col1; i <= col2; i++) {
                let dt = record[this.columns[i].field] || null
                if (extra !== true) {
                    res.push(dt)
                } else {
                    res.push({ data: dt, column: i, index: rec1, record: record })
                }
            }
        } else {
            for (let r = rec1; r <= rec2; r++) {
                let record = this.records[r]
                res.push([])
                for (let i = col1; i <= col2; i++) {
                    let dt = record[this.columns[i].field]
                    if (extra !== true) {
                        res[res.length-1].push(dt)
                    } else {
                        res[res.length-1].push({ data: dt, column: i, index: r, record: record })
                    }
                }
            }
        }
        return res
    }
    addRange(ranges) {
        let added = 0, first, last
        if (this.selectType == 'row') return added
        if (!Array.isArray(ranges)) ranges = [ranges]
        // if it is selection
        for (let i = 0; i < ranges.length; i++) {
            if (typeof ranges[i] != 'object') ranges[i] = { name: 'selection' }
            if (ranges[i].name == 'selection') {
                if (this.show.selectionBorder === false) continue
                let sel = this.getSelection()
                if (sel.length === 0) {
                    this.removeRange('selection')
                    continue
                } else {
                    first = sel[0]
                    last  = sel[sel.length-1]
                }
            } else { // other range
                first = ranges[i].range[0]
                last  = ranges[i].range[1]
            }
            if (first) {
                let rg = {
                    name: ranges[i].name,
                    range: [{ recid: first.recid, column: first.column }, { recid: last.recid, column: last.column }],
                    style: ranges[i].style || ''
                }
                // add range
                let ind = false
                for (let j = 0; j < this.ranges.length; j++) if (this.ranges[j].name == ranges[i].name) { ind = j; break }
                if (ind !== false) {
                    this.ranges[ind] = rg
                } else {
                    this.ranges.push(rg)
                }
                added++
            }
        }
        this.refreshRanges()
        return added
    }
    removeRange() {
        let removed = 0
        for (let a = 0; a < arguments.length; a++) {
            let name = arguments[a]
            $(this.box).find('#grid_'+ this.name +'_'+ name).remove()
            $(this.box).find('#grid_'+ this.name +'_f'+ name).remove()
            for (let r = this.ranges.length-1; r >= 0; r--) {
                if (this.ranges[r].name == name) {
                    this.ranges.splice(r, 1)
                    removed++
                }
            }
        }
        return removed
    }
    refreshRanges() {
        if (this.ranges.length === 0) return
        let obj  = this
        let $range, sLeft, sTop, _left, _top
        let time = (new Date()).getTime()
        let rec1 = $(this.box).find('#grid_'+ this.name +'_frecords')
        let rec2 = $(this.box).find('#grid_'+ this.name +'_records')
        for (let i = 0; i < this.ranges.length; i++) {
            let rg    = this.ranges[i]
            let first = rg.range[0]
            let last  = rg.range[1]
            if (first.index == null) first.index = this.get(first.recid, true)
            if (last.index == null) last.index = this.get(last.recid, true)
            let td1         = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(first.recid) + ' td[col="'+ first.column +'"]')
            let td2         = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(last.recid) + ' td[col="'+ last.column +'"]')
            let td1f        = $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(first.recid) + ' td[col="'+ first.column +'"]')
            let td2f        = $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(last.recid) + ' td[col="'+ last.column +'"]')
            let _lastColumn = last.column
            // adjustment due to column virtual scroll
            if (first.column < this.last.colStart && last.column > this.last.colStart) {
                td1 = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(first.recid) + ' td[col="start"]')
            }
            if (first.column < this.last.colEnd && last.column > this.last.colEnd) {
                _lastColumn = '"end"'
                td2         = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(last.recid) + ' td[col="end"]')
            }
            // if virtual scrolling kicked in
            let index_top     = parseInt($(this.box).find('#grid_'+ this.name +'_rec_top').next().attr('index'))
            let index_bottom  = parseInt($(this.box).find('#grid_'+ this.name +'_rec_bottom').prev().attr('index'))
            let index_ftop    = parseInt($(this.box).find('#grid_'+ this.name +'_frec_top').next().attr('index'))
            let index_fbottom = parseInt($(this.box).find('#grid_'+ this.name +'_frec_bottom').prev().attr('index'))
            if (td1.length === 0 && first.index < index_top && last.index > index_top) {
                td1 = $(this.box).find('#grid_'+ this.name +'_rec_top').next().find('td[col='+ first.column +']')
            }
            if (td2.length === 0 && last.index > index_bottom && first.index < index_bottom) {
                td2 = $(this.box).find('#grid_'+ this.name +'_rec_bottom').prev().find('td[col='+ _lastColumn +']')
            }
            if (td1f.length === 0 && first.index < index_ftop && last.index > index_ftop) { // frozen
                td1f = $(this.box).find('#grid_'+ this.name +'_frec_top').next().find('td[col='+ first.column +']')
            }
            if (td2f.length === 0 && last.index > index_fbottom && first.index < index_fbottom) { // frozen
                td2f = $(this.box).find('#grid_'+ this.name +'_frec_bottom').prev().find('td[col='+ last.column +']')
            }
            // do not show selection cell if it is editable
            let edit = $(this.box).find('#grid_'+ this.name + '_editable')
            let tmp  = edit.find('.w2ui-input')
            let tmp1 = tmp.attr('recid')
            let tmp2 = tmp.attr('column')
            if (rg.name == 'selection' && rg.range[0].recid == tmp1 && rg.range[0].column == tmp2) continue
            // frozen regular columns range
            $range = $(this.box).find('#grid_'+ this.name +'_f'+ rg.name)
            if (td1f.length > 0 || td2f.length > 0) {
                if ($range.length === 0) {
                    rec1.append('<div id="grid_'+ this.name +'_f' + rg.name +'" class="w2ui-selection" style="'+ rg.style +'">'+
                                    (rg.name == 'selection' ? '<div id="grid_'+ this.name +'_resizer" class="w2ui-selection-resizer"></div>' : '')+
                                '</div>')
                    $range = $(this.box).find('#grid_'+ this.name +'_f'+ rg.name)
                } else {
                    $range.attr('style', rg.style)
                    $range.find('.w2ui-selection-resizer').show()
                }
                if (td2f.length === 0) {
                    td2f = $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(last.recid) +' td:last-child')
                    if (td2f.length === 0) td2f = $(this.box).find('#grid_'+ this.name +'_frec_bottom td:first-child')
                    $range.css('border-right', '0px')
                    $range.find('.w2ui-selection-resizer').hide()
                }
                if (first.recid != null && last.recid != null && td1f.length > 0 && td2f.length > 0) {
                    // sLeft = 0 // frozen columns do not need left offset
                    // sTop  = rec2.scrollTop()
                    // // work around jQuery inconsistency between vers >3.2 and <=3.3
                    // if (td1f.find('>div').position().top < 8) {
                    //     sLeft = 0
                    //     sTop  = 0
                    // }
                    // _left = (td1f.position().left - 0 + sLeft)
                    // _top  = (td1f.position().top - 0 + sTop)
                    _left  = (td1f.position().left + td1f.scrollLeft())
                    _top  = (td1f.position().top - td1f.scrollTop())
                    $range.show().css({
                        left    : (_left > 0 ? _left : 0) + 'px',
                        top     : (_top > 0 ? _top : 0) + 'px',
                        width   : (td2f.position().left - td1f.position().left + td2f.width() + 2) + 'px',
                        height  : (td2f.position().top - td1f.position().top + td2f.height() + 1) + 'px'
                    })
                } else {
                    $range.hide()
                }
            } else {
                $range.hide()
            }
            // regular columns range
            $range = $(this.box).find('#grid_'+ this.name +'_'+ rg.name)
            if (td1.length > 0 || td2.length > 0) {
                if ($range.length === 0) {
                    rec2.append('<div id="grid_'+ this.name +'_' + rg.name +'" class="w2ui-selection" style="'+ rg.style +'">'+
                                    (rg.name == 'selection' ? '<div id="grid_'+ this.name +'_resizer" class="w2ui-selection-resizer"></div>' : '')+
                                '</div>')
                    $range = $(this.box).find('#grid_'+ this.name +'_'+ rg.name)
                } else {
                    $range.attr('style', rg.style)
                }
                if (td1.length === 0) {
                    td1 = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(first.recid) +' td:first-child')
                    if (td1.length === 0) td1 = $(this.box).find('#grid_'+ this.name +'_rec_top td:first-child')
                }
                if (td2f.length !== 0) {
                    $range.css('border-left', '0px')
                }
                if (first.recid != null && last.recid != null && td1.length > 0 && td2.length > 0) {
                    // sLeft = rec2.scrollLeft()
                    // sTop  = rec2.scrollTop()
                    // // work around jQuery inconsistency between vers >3.2 and <=3.3
                    // if (td2.find('>div').position().top < 8) {
                    //     sLeft = 0
                    //     sTop  = 0
                    // }
                    // _left = (td1.position().left - 0 + sLeft) // fails if scrolled right
                    // _top  = (td1.position().top - 0 + sTop) // fails if scrolled down
                    _left  = (td1.position().left + td1.scrollLeft())
                    _top  = (td1.position().top - td1.scrollTop())
                    // console.log('top', td1.position().top, rec2.scrollTop(), td1.find('>div').position().top)
                    $range.show().css({
                        left    : (_left > 0 ? _left : 0) + 'px',
                        top     : (_top > 0 ? _top : 0) + 'px',
                        width   : (td2.position().left - td1.position().left + td2.width() + 2) + 'px',
                        height  : (td2.position().top - td1.position().top + td2.height() + 1) + 'px'
                    })
                } else {
                    $range.hide()
                }
            } else {
                $range.hide()
            }
        }
        // add resizer events
        $(this.box).find('.w2ui-selection-resizer')
            .off('mousedown').on('mousedown', mouseStart)
            .off('dblclick').on('dblclick', function(event) {
                let edata = obj.trigger('resizerDblClick', { target: obj.name, originalEvent: event })
                if (edata.isCancelled === true) return
                edata.finish()
            })
        let edata = { phase: 'before', type: 'selectionExtend', target: obj.name, originalRange: null, newRange: null }
        return (new Date()).getTime() - time
        function mouseStart (event) {
            let sel       = obj.getSelection()
            obj.last.move = {
                type   : 'expand',
                x      : event.screenX,
                y      : event.screenY,
                divX   : 0,
                divY   : 0,
                recid  : sel[0].recid,
                column : sel[0].column,
                originalRange : [{ recid: sel[0].recid, column: sel[0].column }, { recid: sel[sel.length-1].recid, column: sel[sel.length-1].column }],
                newRange      : [{ recid: sel[0].recid, column: sel[0].column }, { recid: sel[sel.length-1].recid, column: sel[sel.length-1].column }]
            }
            $(document)
                .off('.w2ui-' + obj.name)
                .on('mousemove.w2ui-' + obj.name, mouseMove)
                .on('mouseup.w2ui-' + obj.name, mouseStop)
            // do not blur grid
            event.preventDefault()
        }
        function mouseMove (event) {
            let mv = obj.last.move
            if (!mv || mv.type != 'expand') return
            mv.divX = (event.screenX - mv.x)
            mv.divY = (event.screenY - mv.y)
            // find new cell
            let recid, column
            let tmp = event.originalEvent.target
            if (tmp.tagName.toUpperCase() != 'TD') tmp = $(tmp).parents('td')[0]
            if ($(tmp).attr('col') != null) column = parseInt($(tmp).attr('col'))
            tmp   = $(tmp).parents('tr')[0]
            recid = $(tmp).attr('recid')
            // new range
            if (mv.newRange[1].recid == recid && mv.newRange[1].column == column) return
            let prevNewRange = $.extend({}, mv.newRange)
            mv.newRange      = [{ recid: mv.recid, column: mv.column }, { recid: recid, column: column }]
            // event before
            edata = obj.trigger(w2utils.extend(edata, { originalRange: mv.originalRange, newRange : mv.newRange }))
            if (edata.isCancelled === true) {
                mv.newRange    = prevNewRange
                edata.detail.newRange = prevNewRange
                return
            } else {
                // default behavior
                obj.removeRange('grid-selection-expand')
                obj.addRange({
                    name  : 'grid-selection-expand',
                    range : edata.detail.newRange,
                    style : 'background-color: rgba(100,100,100,0.1); border: 2px dotted rgba(100,100,100,0.5);'
                })
            }
        }
        function mouseStop (event) {
            // default behavior
            obj.removeRange('grid-selection-expand')
            delete obj.last.move
            $(document).off('.w2ui-' + obj.name)
            // event after
            edata.finish()
        }
    }
    select() {
        if (arguments.length === 0) return 0
        let selected = 0
        let sel      = this.last.selection
        if (!this.multiSelect) this.selectNone()
        // if too many arguments > 150k, then it errors off
        let args = Array.from(arguments)
        if (Array.isArray(args[0])) args = args[0]
        // event before
        let tmp = { target: this.name }
        if (args.length == 1) {
            tmp.multiple = false
            if ($.isPlainObject(args[0])) {
                tmp.recid  = args[0].recid
                tmp.column = args[0].column
            } else {
                tmp.recid = args[0]
            }
        } else {
            tmp.multiple = true
            tmp.recids   = args
        }
        let edata = this.trigger('select', tmp)
        if (edata.isCancelled === true) return 0
        // default action
        if (this.selectType == 'row') {
            for (let a = 0; a < args.length; a++) {
                let recid = typeof args[a] == 'object' ? args[a].recid : args[a]
                let index = this.get(recid, true)
                if (index == null) continue
                let recEl1 = null
                let recEl2 = null
                if (this.searchData.length !== 0 || (index + 1 >= this.last.range_start && index + 1 <= this.last.range_end)) {
                    recEl1 = $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid))
                    recEl2 = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid))
                }
                if (this.selectType == 'row') {
                    if (sel.indexes.indexOf(index) != -1) continue
                    sel.indexes.push(index)
                    if (recEl1 && recEl2) {
                        recEl1.addClass('w2ui-selected').data('selected', 'yes').find('.w2ui-col-number').addClass('w2ui-row-selected')
                        recEl2.addClass('w2ui-selected').data('selected', 'yes').find('.w2ui-col-number').addClass('w2ui-row-selected')
                        recEl1.find('.w2ui-grid-select-check').prop('checked', true)
                    }
                    selected++
                }
            }
        } else {
            // normalize for performance
            let new_sel = {}
            for (let a = 0; a < args.length; a++) {
                let recid      = typeof args[a] == 'object' ? args[a].recid : args[a]
                let column     = typeof args[a] == 'object' ? args[a].column : null
                new_sel[recid] = new_sel[recid] || []
                if (Array.isArray(column)) {
                    new_sel[recid] = column
                } else if (w2utils.isInt(column)) {
                    new_sel[recid].push(column)
                } else {
                    for (let i = 0; i < this.columns.length; i++) { if (this.columns[i].hidden) continue; new_sel[recid].push(parseInt(i)) }
                }
            }
            // add all
            let col_sel = []
            for (let recid in new_sel) {
                let index = this.get(recid, true)
                if (index == null) continue
                let recEl1 = null
                let recEl2 = null
                if (index + 1 >= this.last.range_start && index + 1 <= this.last.range_end) {
                    recEl1 = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid))
                    recEl2 = $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid))
                }
                let s = sel.columns[index] || []
                // default action
                if (sel.indexes.indexOf(index) == -1) {
                    sel.indexes.push(index)
                }
                // only only those that are new
                for (let t = 0; t < new_sel[recid].length; t++) {
                    if (s.indexOf(new_sel[recid][t]) == -1) s.push(new_sel[recid][t])
                }
                s.sort((a, b) => { return a-b }) // sort function must be for numerical sort
                for (let t = 0; t < new_sel[recid].length; t++) {
                    let col = new_sel[recid][t]
                    if (col_sel.indexOf(col) == -1) col_sel.push(col)
                    if (recEl1) {
                        recEl1.find('#grid_'+ this.name +'_data_'+ index +'_'+ col).addClass('w2ui-selected')
                        recEl1.find('.w2ui-col-number').addClass('w2ui-row-selected')
                        recEl1.data('selected', 'yes')
                        recEl1.find('.w2ui-grid-select-check').prop('checked', true)
                    }
                    if (recEl2) {
                        recEl2.find('#grid_'+ this.name +'_data_'+ index +'_'+ col).addClass('w2ui-selected')
                        recEl2.find('.w2ui-col-number').addClass('w2ui-row-selected')
                        recEl2.data('selected', 'yes')
                        recEl2.find('.w2ui-grid-select-check').prop('checked', true)
                    }
                    selected++
                }
                // save back to selection object
                sel.columns[index] = s
            }
            // select columns (need here for speed)
            for (let c = 0; c < col_sel.length; c++) {
                $(this.box).find('#grid_'+ this.name +'_column_'+ col_sel[c] +' .w2ui-col-header').addClass('w2ui-col-selected')
            }
        }
        // need to sort new selection for speed
        sel.indexes.sort((a, b) => { return a-b })
        // all selected?
        let areAllSelected = (this.records.length > 0 && sel.indexes.length == this.records.length),
            areAllSearchedSelected = (sel.indexes.length > 0 && this.searchData.length !== 0 && sel.indexes.length == this.last.searchIds.length)
        if (areAllSelected || areAllSearchedSelected) {
            $(this.box).find('#grid_'+ this.name +'_check_all').prop('checked', true)
        } else {
            $(this.box).find('#grid_'+ this.name +'_check_all').prop('checked', false)
        }
        this.status()
        this.addRange('selection')
        this.updateToolbar(sel, areAllSelected)
        // event after
        edata.finish()
        return selected
    }
    unselect() {
        let unselected = 0
        let sel        = this.last.selection
        // if too many arguments > 150k, then it errors off
        let args = Array.from(arguments)
        if (Array.isArray(args[0])) args = args[0]
        // event before
        let tmp = { target: this.name }
        if (args.length == 1) {
            tmp.multiple = false
            if ($.isPlainObject(args[0])) {
                tmp.recid  = args[0].recid
                tmp.column = args[0].column
            } else {
                tmp.recid = args[0]
            }
        } else {
            tmp.multiple = true
            tmp.recids   = args
        }
        let edata = this.trigger('unselect', tmp)
        if (edata.isCancelled === true) return 0
        for (let a = 0; a < args.length; a++) {
            let recid  = typeof args[a] == 'object' ? args[a].recid : args[a]
            let record = this.get(recid)
            if (record == null) continue
            let index  = this.get(record.recid, true)
            let recEl1 = $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid))
            let recEl2 = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid))
            if (this.selectType == 'row') {
                if (sel.indexes.indexOf(index) == -1) continue
                // default action
                sel.indexes.splice(sel.indexes.indexOf(index), 1)
                recEl1.removeClass('w2ui-selected w2ui-inactive').removeData('selected').find('.w2ui-col-number').removeClass('w2ui-row-selected')
                recEl2.removeClass('w2ui-selected w2ui-inactive').removeData('selected').find('.w2ui-col-number').removeClass('w2ui-row-selected')
                if (recEl1.length != 0) {
                    recEl1[0].style.cssText = 'height: '+ this.recordHeight +'px; ' + recEl1.attr('custom_style')
                    recEl2[0].style.cssText = 'height: '+ this.recordHeight +'px; ' + recEl2.attr('custom_style')
                }
                recEl1.find('.w2ui-grid-select-check').prop('checked', false)
                unselected++
            } else {
                let col = args[a].column
                if (!w2utils.isInt(col)) { // unselect all columns
                    let cols = []
                    for (let i = 0; i < this.columns.length; i++) { if (this.columns[i].hidden) continue; cols.push({ recid: recid, column: i }) }
                    return this.unselect(cols)
                }
                let s = sel.columns[index]
                if (!Array.isArray(s) || s.indexOf(col) == -1) continue
                // default action
                s.splice(s.indexOf(col), 1)
                $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid)).find(' > td[col='+ col +']').removeClass('w2ui-selected w2ui-inactive')
                $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid)).find(' > td[col='+ col +']').removeClass('w2ui-selected w2ui-inactive')
                // check if any row/column still selected
                let isColSelected = false
                let isRowSelected = false
                let tmp           = this.getSelection()
                for (let i = 0; i < tmp.length; i++) {
                    if (tmp[i].column == col) isColSelected = true
                    if (tmp[i].recid == recid) isRowSelected = true
                }
                if (!isColSelected) {
                    $(this.box).find('.w2ui-grid-columns td[col='+ col +'] .w2ui-col-header, .w2ui-grid-fcolumns td[col='+ col +'] .w2ui-col-header').removeClass('w2ui-col-selected')
                }
                if (!isRowSelected) {
                    $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid)).find('.w2ui-col-number').removeClass('w2ui-row-selected')
                }
                unselected++
                if (s.length === 0) {
                    delete sel.columns[index]
                    sel.indexes.splice(sel.indexes.indexOf(index), 1)
                    recEl1.removeData('selected')
                    recEl1.find('.w2ui-grid-select-check').prop('checked', false)
                    recEl2.removeData('selected')
                }
            }
        }
        // all selected?
        let areAllSelected = (this.records.length > 0 && sel.indexes.length == this.records.length),
            areAllSearchedSelected = (sel.indexes.length > 0 && this.searchData.length !== 0 && sel.indexes.length == this.last.searchIds.length)
        if (areAllSelected || areAllSearchedSelected) {
            $(this.box).find('#grid_'+ this.name +'_check_all').prop('checked', true)
        } else {
            $(this.box).find('#grid_'+ this.name +'_check_all').prop('checked', false)
        }
        // show number of selected
        this.status()
        this.addRange('selection')
        this.updateToolbar(sel, areAllSelected)
        // event after
        edata.finish()
        return unselected
    }
    selectAll() {
        let time = (new Date()).getTime()
        if (this.multiSelect === false) return
        // event before
        let edata = this.trigger('select', { target: this.name, all: true })
        if (edata.isCancelled === true) return
        // default action
        let url  = (typeof this.url != 'object' ? this.url : this.url.get)
        let sel  = this.last.selection
        let cols = []
        for (let i = 0; i < this.columns.length; i++) cols.push(i)
        // if local data source and searched
        sel.indexes = []
        if (!url && this.searchData.length !== 0) {
            // local search applied
            for (let i = 0; i < this.last.searchIds.length; i++) {
                sel.indexes.push(this.last.searchIds[i])
                if (this.selectType != 'row') sel.columns[this.last.searchIds[i]] = cols.slice() // .slice makes copy of the array
            }
        } else {
            let buffered = this.records.length
            if (this.searchData.length != 0 && !url) buffered = this.last.searchIds.length
            for (let i = 0; i < buffered; i++) {
                sel.indexes.push(i)
                if (this.selectType != 'row') sel.columns[i] = cols.slice() // .slice makes copy of the array
            }
        }
        // add selected class
        if (this.selectType == 'row') {
            $(this.box).find('.w2ui-grid-records tr').not('.w2ui-empty-record')
                .addClass('w2ui-selected').data('selected', 'yes').find('.w2ui-col-number').addClass('w2ui-row-selected')
            $(this.box).find('.w2ui-grid-frecords tr').not('.w2ui-empty-record')
                .addClass('w2ui-selected').data('selected', 'yes').find('.w2ui-col-number').addClass('w2ui-row-selected')
            $(this.box).find('input.w2ui-grid-select-check').prop('checked', true)
        } else {
            $(this.box).find('.w2ui-grid-columns td .w2ui-col-header, .w2ui-grid-fcolumns td .w2ui-col-header').addClass('w2ui-col-selected')
            $(this.box).find('.w2ui-grid-records tr .w2ui-col-number').addClass('w2ui-row-selected')
            $(this.box).find('.w2ui-grid-records tr').not('.w2ui-empty-record')
                .find('.w2ui-grid-data').not('.w2ui-col-select').addClass('w2ui-selected').data('selected', 'yes')
            $(this.box).find('.w2ui-grid-frecords tr .w2ui-col-number').addClass('w2ui-row-selected')
            $(this.box).find('.w2ui-grid-frecords tr').not('.w2ui-empty-record')
                .find('.w2ui-grid-data').not('.w2ui-col-select').addClass('w2ui-selected').data('selected', 'yes')
            $(this.box).find('input.w2ui-grid-select-check').prop('checked', true)
        }
        // enable/disable toolbar buttons
        sel = this.getSelection(true)
        this.addRange('selection')
        $(this.box).find('#grid_'+ this.name +'_check_all').prop('checked', true)
        this.status()
        this.updateToolbar({ indexes: sel }, true)
        // event after
        edata.finish()
        return (new Date()).getTime() - time
    }
    selectNone() {
        let time = (new Date()).getTime()
        // event before
        let edata = this.trigger('unselect', { target: this.name, all: true })
        if (edata.isCancelled === true) return
        // default action
        let sel = this.last.selection
        // remove selected class
        if (this.selectType == 'row') {
            $(this.box).find('.w2ui-grid-records tr.w2ui-selected').removeClass('w2ui-selected w2ui-inactive').removeData('selected')
                .find('.w2ui-col-number').removeClass('w2ui-row-selected')
            $(this.box).find('.w2ui-grid-frecords tr.w2ui-selected').removeClass('w2ui-selected w2ui-inactive').removeData('selected')
                .find('.w2ui-col-number').removeClass('w2ui-row-selected')
            $(this.box).find('input.w2ui-grid-select-check').prop('checked', false)
        } else {
            $(this.box).find('.w2ui-grid-columns td .w2ui-col-header, .w2ui-grid-fcolumns td .w2ui-col-header').removeClass('w2ui-col-selected')
            $(this.box).find('.w2ui-grid-records tr .w2ui-col-number').removeClass('w2ui-row-selected')
            $(this.box).find('.w2ui-grid-frecords tr .w2ui-col-number').removeClass('w2ui-row-selected')
            $(this.box).find('.w2ui-grid-data.w2ui-selected').removeClass('w2ui-selected w2ui-inactive').removeData('selected')
            $(this.box).find('input.w2ui-grid-select-check').prop('checked', false)
        }
        sel.indexes = []
        sel.columns = {}
        this.removeRange('selection')
        $(this.box).find('#grid_'+ this.name +'_check_all').prop('checked', false)
        this.status()
        this.updateToolbar(sel, false)
        // event after
        edata.finish()
        return (new Date()).getTime() - time
    }
    updateToolbar(sel) {
        let obj = this
        let cnt = sel && sel.indexes ? sel.indexes.length : 0
        this.toolbar.items.forEach((item) => {
            _checkItem(item, '')
            if (Array.isArray(item.items)) {
                item.items.forEach((it) => {
                    _checkItem(it, item.id + ':')
                })
            }
        })
        // enable/disable toolbar search button
        if (this.show.toolbarSave) {
            if (this.getChanges().length > 0) {
                this.toolbar.enable('w2ui-save')
            } else {
                this.toolbar.disable('w2ui-save')
            }
        }
        function _checkItem(item, prefix) {
            if (item.batch != null) {
                let enabled = false
                if (item.batch === true) {
                    if (cnt > 0) enabled = true
                } else if (typeof item.batch == 'number') {
                    if (cnt === item.batch) enabled = true
                } else if (typeof item.batch == 'function') {
                    enabled = item.batch({ cnt, sel })
                }
                if (enabled) {
                    obj.toolbar.enable(prefix + item.id)
                } else {
                    obj.toolbar.disable(prefix + item.id)
                }
            }
        }
    }
    getSelection(returnIndex) {
        let ret = []
        let sel = this.last.selection
        if (this.selectType == 'row') {
            for (let i = 0; i < sel.indexes.length; i++) {
                if (!this.records[sel.indexes[i]]) continue
                if (returnIndex === true) ret.push(sel.indexes[i]); else ret.push(this.records[sel.indexes[i]].recid)
            }
            return ret
        } else {
            for (let i = 0; i < sel.indexes.length; i++) {
                let cols = sel.columns[sel.indexes[i]]
                if (!this.records[sel.indexes[i]]) continue
                for (let j = 0; j < cols.length; j++) {
                    ret.push({ recid: this.records[sel.indexes[i]].recid, index: parseInt(sel.indexes[i]), column: cols[j] })
                }
            }
            return ret
        }
    }
    search(field, value) {
        let url               = (typeof this.url != 'object' ? this.url : this.url.get)
        let searchData        = []
        let last_multi        = this.last.multi
        let last_logic        = this.last.logic
        let last_field        = this.last.field
        let last_search       = this.last.search
        let hasHiddenSearches = false
        // add hidden searches
        for (let i = 0; i < this.searches.length; i++) {
            if (!this.searches[i].hidden || this.searches[i].value == null) continue
            searchData.push({
                field    : this.searches[i].field,
                operator : this.searches[i].operator || 'is',
                type     : this.searches[i].type,
                value    : this.searches[i].value || ''
            })
            hasHiddenSearches = true
        }
        // 1: search() - advanced search (reads from popup)
        if (arguments.length === 0) {
            this.focus() // otherwise search drop down covers searches
            last_logic = $(this.box).find(`#grid_${this.name}_logic`).val()
            last_search = ''
            // advanced search
            for (let i = 0; i < this.searches.length; i++) {
                let search   = this.searches[i]
                let operator = $(this.box).find('#grid_'+ this.name + '_operator_'+ i).val()
                let field1   = $(this.box).find('#grid_'+ this.name + '_field_'+ i)
                let field2   = $(this.box).find('#grid_'+ this.name + '_field2_'+ i)
                let value1   = field1.val()
                let value2   = field2.val()
                let svalue   = null
                let text     = null
                if (['int', 'float', 'money', 'currency', 'percent'].indexOf(search.type) != -1) {
                    let fld1 = field1.data('w2field')
                    let fld2 = field2.data('w2field')
                    if (fld1) value1 = fld1.clean(value1)
                    if (fld2) value2 = fld2.clean(value2)
                }
                if (['list', 'enum'].indexOf(search.type) != -1 || ['in', 'not in'].indexOf(operator) != -1) {
                    value1 = field1.data('selected') || {}
                    if (Array.isArray(value1)) {
                        svalue = []
                        for (let j = 0; j < value1.length; j++) {
                            svalue.push(w2utils.isFloat(value1[j].id) ? parseFloat(value1[j].id) : String(value1[j].id).toLowerCase())
                            delete value1[j].hidden
                        }
                        if ($.isEmptyObject(value1)) value1 = ''
                    } else {
                        text   = value1.text || ''
                        value1 = value1.id || ''
                    }
                }
                if ((value1 !== '' && value1 != null) || (value2 != null && value2 !== '')) {
                    let tmp = {
                        field    : search.field,
                        type     : search.type,
                        operator : operator
                    }
                    if (operator == 'between') {
                        $.extend(tmp, { value: [value1, value2] })
                    } else if (operator == 'in' && typeof value1 == 'string') {
                        $.extend(tmp, { value: value1.split(',') })
                    } else if (operator == 'not in' && typeof value1 == 'string') {
                        $.extend(tmp, { value: value1.split(',') })
                    } else {
                        $.extend(tmp, { value: value1 })
                    }
                    if (svalue) $.extend(tmp, { svalue: svalue })
                    if (text) $.extend(tmp, { text: text })
                    // convert date to unix time
                    try {
                        if (search.type == 'date' && operator == 'between') {
                            tmp.value[0] = value1 // w2utils.isDate(value1, w2utils.settings.dateFormat, true).getTime();
                            tmp.value[1] = value2 // w2utils.isDate(value2, w2utils.settings.dateFormat, true).getTime();
                        }
                        if (search.type == 'date' && operator == 'is') {
                            tmp.value = value1 // w2utils.isDate(value1, w2utils.settings.dateFormat, true).getTime();
                        }
                    } catch (e) {
                    }
                    searchData.push(tmp)
                    last_multi = true // if only hidden searches, then do not set
                }
            }
        }
        // 2: search(field, value) - regular search
        if (typeof field == 'string') {
            // if only one argument - search all
            if (arguments.length == 1) {
                value = field
                field = 'all'
            }
            last_field  = field
            last_search = value
            last_multi  = false
            last_logic  = (hasHiddenSearches ? 'AND' : 'OR')
            // loop through all searches and see if it applies
            if (value != null) {
                if (field.toLowerCase() == 'all') {
                    // if there are search fields loop thru them
                    if (this.searches.length > 0) {
                        for (let i = 0; i < this.searches.length; i++) {
                            let search = this.searches[i]
                            if (search.type == 'text' || (search.type == 'alphanumeric' && w2utils.isAlphaNumeric(value))
                                    || (search.type == 'int' && w2utils.isInt(value)) || (search.type == 'float' && w2utils.isFloat(value))
                                    || (search.type == 'percent' && w2utils.isFloat(value)) || ((search.type == 'hex' || search.type == 'color') && w2utils.isHex(value))
                                    || (search.type == 'currency' && w2utils.isMoney(value)) || (search.type == 'money' && w2utils.isMoney(value))
                                    || (search.type == 'date' && w2utils.isDate(value)) || (search.type == 'time' && w2utils.isTime(value))
                                    || (search.type == 'datetime' && w2utils.isDateTime(value)) || (search.type == 'datetime' && w2utils.isDate(value))
                                    || (search.type == 'enum' && w2utils.isAlphaNumeric(value)) || (search.type == 'list' && w2utils.isAlphaNumeric(value))
                            ) {
                                let def = this.defaultOperator[this.operatorsMap[search.type]]
                                let tmp = {
                                    field    : search.field,
                                    type     : search.type,
                                    operator : (search.operator != null ? search.operator : def),
                                    value    : value
                                }
                                if (String(value).trim() != '') searchData.push(tmp)
                            }
                            // range in global search box
                            if (['int', 'float', 'money', 'currency', 'percent'].indexOf(search.type) != -1 && String(value).trim().split('-').length == 2) {
                                let t   = String(value).trim().split('-')
                                let tmp = {
                                    field    : search.field,
                                    type     : search.type,
                                    operator : (search.operator != null ? search.operator : 'between'),
                                    value    : [t[0], t[1]]
                                }
                                searchData.push(tmp)
                            }
                            // lists fields
                            if (['list', 'enum'].indexOf(search.type) != -1) {
                                let new_values = []
                                if (search.options == null) search.options = {}
                                if (!Array.isArray(search.options.items)) search.options.items = []
                                for (let j = 0; j < search.options.items; j++) {
                                    let tmp = search.options.items[j]
                                    try {
                                        let re = new RegExp(value, 'i')
                                        if (re.test(tmp)) new_values.push(j)
                                        if (tmp.text && re.test(tmp.text)) new_values.push(tmp.id)
                                    } catch (e) {}
                                }
                                if (new_values.length > 0) {
                                    let tmp = {
                                        field    : search.field,
                                        type     : search.type,
                                        operator : (search.operator != null ? search.operator : 'in'),
                                        value    : new_values
                                    }
                                    searchData.push(tmp)
                                }
                            }
                        }
                    } else {
                        // no search fields, loop thru columns
                        for (let i = 0; i < this.columns.length; i++) {
                            let tmp = {
                                field    : this.columns[i].field,
                                type     : 'text',
                                operator : this.defaultOperator.text,
                                value    : value
                            }
                            searchData.push(tmp)
                        }
                    }
                } else {
                    let el     = $(this.box).find('#grid_'+ this.name +'_search_all')
                    let search = this.getSearch(field)
                    if (search == null) search = { field: field, type: 'text' }
                    if (search.field == field) this.last.label = search.label
                    if (value !== '') {
                        let op  = this.defaultOperator[this.operatorsMap[search.type]]
                        let val = value
                        if (['date', 'time', 'datetime'].indexOf(search.type) != -1) op = 'is'
                        if (['list', 'enum'].indexOf(search.type) != -1) {
                            op      = 'is'
                            let tmp = el.data('selected')
                            if (tmp && !$.isEmptyObject(tmp)) val = tmp.id; else val = ''
                        }
                        if (search.type == 'int' && value !== '') {
                            op = 'is'
                            if (String(value).indexOf('-') != -1) {
                                let tmp = value.split('-')
                                if (tmp.length == 2) {
                                    op  = 'between'
                                    val = [parseInt(tmp[0]), parseInt(tmp[1])]
                                }
                            }
                            if (String(value).indexOf(',') != -1) {
                                let tmp = value.split(',')
                                op      = 'in'
                                val     = []
                                for (let i = 0; i < tmp.length; i++) val.push(tmp[i])
                            }
                        }
                        if (search.operator != null) op = search.operator
                        let tmp = {
                            field    : search.field,
                            type     : search.type,
                            operator : op,
                            value    : val
                        }
                        searchData.push(tmp)
                    }
                }
            }
        }
        // 3: search([ { field, value, [operator,] [type] }, { field, value, [operator,] [type] } ], logic) - submit whole structure
        if (Array.isArray(field)) {
            let logic = 'AND'
            if (typeof value == 'string') {
                logic = value.toUpperCase()
                if (logic != 'OR' && logic != 'AND') logic = 'AND'
            }
            last_search = ''
            last_multi  = true
            last_logic  = logic
            for (let i = 0; i < field.length; i++) {
                let data = field[i]
                if (typeof data.value == 'number') data.operator = this.defaultOperator.number
                if (typeof data.value == 'string') data.operator = this.defaultOperator.text
                if (Array.isArray(data.value)) data.operator = this.defaultOperator.enum
                if (w2utils.isDate(data.value)) data.operator = this.defaultOperator.date
                // merge current field and search if any
                searchData.push(data)
            }
        }
        // event before
        let edata = this.trigger('search', {
            target: this.name,
            multi: (arguments.length === 0 ? true : false),
            searchField: (field ? field : 'multi'),
            searchValue: (field ? value : 'multi'),
            searchData: searchData,
            searchLogic: last_logic
        })
        if (edata.isCancelled === true) return
        // default action
        this.searchData             = edata.detail.searchData
        this.last.field             = last_field
        this.last.search            = last_search
        this.last.multi             = last_multi
        this.last.logic             = edata.detail.searchLogic
        this.last.scrollTop         = 0
        this.last.scrollLeft        = 0
        this.last.selection.indexes = []
        this.last.selection.columns = {}
        // -- clear all search field
        this.searchClose()
        // apply search
        if (url) {
            this.last.xhr_offset = 0
            this.reload()
        } else {
            // local search
            this.localSearch()
            this.refresh()
        }
        // event after
        edata.finish()
    }
    searchOpen() {
        if (!this.box) return
        if (this.searches.length === 0) return
        // event before
        let edata = this.trigger('searchOpen', { target: this.name })
        if (edata.isCancelled === true) {
            return
        }
        let $btn = query(this.toolbar.box).find('.w2ui-grid-search-input .w2ui-search-drop')
        $btn.addClass('checked')
        // show search
        w2tooltip.show({
            name  : this.name + '-search-overlay',
            anchor: query(this.box).find('#grid_'+ this.name +'_search_all').get(0),
            html  : this.getSearchesHTML(),
            align : 'left',
            arrowSize: 12,
            class : 'w2ui-grid-search-advanced',
            hideOn: ['doc-click']
        })
        .then(event => {
            this.initSearches()
            this.last.search_opened = true
            query(`#w2overlay-${this.name}-search-overlay .w2ui-grid-search-advanced`)
                .data('gridName', this.name)
            w2utils.bindEvents(query(`#w2overlay-${this.name}-search-overlay`).find('select, input, button'), this)
            // init first field
            let sfields = query(`#w2overlay-${this.name}-search-overlay *[rel=search]`)
            if (sfields.length > 0) sfields[0].focus()
            // event after
            edata.finish()
        })
        .hide(event => {
            $btn.removeClass('checked')
            this.last.search_opened = false
        })
    }
    searchClose() {
        w2tooltip.hide(this.name + '-search-overlay')
    }
    searchSuggest(imediate, forceHide, input) {
        clearTimeout(this.last.kbd_timer)
        clearTimeout(this.last.overlay_timer)
        this.searchShowFields(true)
        this.searchClose()
        if (forceHide === true) {
            w2tooltip.hide(this.name + '-search-suggest')
            return
        }
        if ($(`#w2overlay-${this.name}-search-suggest`).length > 0) {
            // already shown
            return
        }
        if (!imediate) {
            this.last.overlay_timer = setTimeout(() => { this.searchSuggest(true) }, 100)
            return
        }
        let el = query(this.box).find(`#grid_${this.name}_search_all`).get(0)
        if (Array.isArray(this.savedSearches) && this.savedSearches.length > 0) {
            w2menu.show({
                name: this.name + '-search-suggest',
                anchor: el,
                align: 'both',
                items: this.savedSearches,
                topHTML: `<div class="w2ui-grid-search-suggest">${w2utils.lang('Saved Searches')}</div>`,
                hideOn: ['doc-click', 'sleect', 'remove'],
                render(item) {
                    let ret = item.text
                    if (item.isDefault) ret = `<b>${ret}</b>`
                    return ret
                }
            })
            .select(event => {
                let edata = this.trigger('searchSelect', {
                    target: this.name,
                    index: event.detail.index,
                    item: event.detail.item
                })
                if (edata.isCancelled === true) {
                    event.preventDefault()
                    return
                }
                this.last.logic  = event.detail.item.logic || 'AND'
                this.last.search = ''
                this.last.label  = '[Multiple Fields]'
                this.searchData  = w2utils.extend([], event.detail.item.data)
                this.searchSelected = {
                    name: event.detail.item.id,
                    logic: event.detail.item.logic,
                    data: this.searchData
                }
                this.reload()
                edata.finish()
            })
            .remove(event => {
                let item = event.detail.item
                let edata = this.trigger('searchRemove', { target: this.name, index: event.detail.index, item })
                if (edata.isCancelled === true) {
                    event.preventDefault()
                    return
                }
                this.confirm(w2utils.lang('Do you want to delete search item "${item}"?', { item: item.text }))
                    .yes(evt => {
                        if (w2utils.hasLocalStorage && this.useLocalStorage) {
                            try {
                                let tmp = JSON.parse(localStorage.w2ui || '{}')
                                if (tmp && tmp.searches) {
                                    let searches = tmp.searches[(this.stateId || this.name)]
                                    if (Array.isArray(searches)) {
                                        let search = searches.findIndex((s, ind) => s.name == item.id ? true : false)
                                        if (search !== null) {
                                            searches.splice(search, 1)
                                        }
                                        localStorage.w2ui = JSON.stringify(tmp)
                                    }
                                }
                            } catch (e) {
                            }
                        }
                        // remove from searches
                        let search = this.savedSearches.findIndex((s, ind) => s.name == item.id ? true : false)
                        if (search !== null) {
                            this.savedSearches.splice(search, 1)
                        }
                        evt.detail.self.close()
                        // evt after
                        edata.finish()
                    })
                    .no(evt => {
                        evt.detail.self.close()
                    })
            })
        }
    }
    searchFieldDrop(ind, sd_ind, el) {
        let grid = this
        let sf = this.searches[ind]
        let sd = this.searchData[sd_ind]
        let operator = `<select id="grid_${this.name}_operator_${ind}" class="w2ui-input" style="padding: 1px 7px; font-size: 13px; height: 27px;"
               onchange="w2ui['${this.name}'].initOperator(${ind})">${this.getOperators(sf.type, sf.operators)}</select>`
        let value = ''
        switch (sf.type) {
            case 'text':
            case 'alphanumeric':
            case 'hex':
            case 'color':
            case 'list':
            case 'combo':
            case 'enum': {
                let tmpStyle = 'width: 250px;'
                if (['hex', 'color'].indexOf(sf.type) != -1) tmpStyle = 'width: 90px;'
                value += '<input rel="search" type="text" id="grid_'+ this.name +'_field_'+ ind +'" name="'+ sf.field +'" '+
                        '   class="w2ui-input" style="'+ tmpStyle + sf.style +'" '+ sf.inTag +'/>'
                break
            }
            case 'int':
            case 'float':
            case 'money':
            case 'currency':
            case 'percent':
            case 'date':
            case 'time':
            case 'datetime':
                let tmpStyle = 'width: 80px'
                if (sf.type == 'datetime') tmpStyle = 'width: 140px;'
                value += '<input rel="search" type="text" class="w2ui-input" style="'+ tmpStyle + sf.style +'" id="grid_'+ this.name +'_field_'+ ind +'" name="'+ sf.field +'" '+ sf.inTag +'/>'+
                        '<span id="grid_'+ this.name +'_extra1_'+ ind +'" style="padding-left: 5px; color: #6f6f6f; font-size: 10px"></span>'+
                        '<span id="grid_'+ this.name +'_range_'+ ind +'" style="display: none">&#160;-&#160;&#160;'+
                        '<input rel="search" type="text" class="w2ui-input" style="'+ tmpStyle + sf.style +'" id="grid_'+ this.name +'_field2_'+ ind +'" name="'+ sf.field +'" '+ sf.inTag +'/>'+
                        '</span>'+
                        '<span id="grid_'+ this.name +'_extra2_'+ ind +'" style="padding-left: 5px; color: #6f6f6f; font-size: 10px"></span>'
                break
            case 'select':
                value += '<select rel="search" class="w2ui-input" style="'+ sf.style +'" id="grid_'+ this.name +'_field_'+ ind +'" '+
                        ' name="'+ sf.field +'" '+ sf.inTag +'  onclick="event.stopPropagation();"></select>'
                break
        }
        let oper = sd.operator
        if (oper == 'more' && sd.type == 'date') oper = 'since'
        if (oper == 'less' && sd.type == 'date') oper = 'before'
        let options = ''
        let val = sd.value
        if (Array.isArray(sd.value)) { // && Array.isArray(sf.options.items)) {
            sd.value.forEach(opt => {
                options += `<li>${opt.text || opt}</li>`
            })
            if (sd.type == 'date') {
                options = ''
                sd.value.forEach(opt => {
                    options += `<li>${w2utils.formatDate(opt)}</li>`
                })
            }
            // sf.options.items.forEach(txt => {
            //     let isSelected = (sd.svalue.indexOf(txt.toLowerCase()) != -1 ? true : false)
            //     options += `<li><label><input type="checkbox" ${isSelected ? 'checked' : ''}>${txt}</label></li>`
            // })
        } else {
            if (sd.type == 'date') {
                val = w2utils.formatDateTime(val)
                // if (oper.substr(0, 5) == 'more:') {
                //     let tmp = Number(oper.substr(5))
                //     val = w2utils.formatDateTime(new Date((new Date()).getTime() + tmp))
                //     oper = 'since'
                // }
            }
        }
        w2tooltip.show({
            name: this.name + '-search-props',
            anchor: el,
            class: 'w2ui-white',
            hideOn: 'doc-click',
            html: `
                <div class="w2ui-grid-search-single">
                    <span class="operator">${w2utils.lang(oper)}</span>
                    ${Array.isArray(sd.value)
                        ? `<div class="options"> <ul>${options}</ul> </div>`
                        : `<span>${val}</span>`
                    }
                    <div class="buttons">
                        <button id="remove" class="w2ui-btn">${w2utils.lang('Remove This Field')}</button>
                    </div>
                </div>`
        }).then(event => {
            query(event.detail.overlay.box).find('#remove').on('click', () => {
                grid.searchData.splice(`${sd_ind}`, 1)
                grid.reload()
                grid.localSearch()
                w2tooltip.hide(this.name + '-search-props')
            })
        })
    }
    searchSave() {
        let value = ''
        if (this.searchSelected) {
            value = this.searchSelected.name
        }
        let grid = this
        // event before
        let edata = this.trigger('searchSave', { target: this.name, saveLocalStorage: true })
        if (edata.isCancelled === true) return
        this.message({
            width: 350,
            height: 150,
            body: `<div style="padding-top: 29px; text-align: center;">
                <span style="width: 280px; display: inline-block; text-align: left; padding-bottom: 4px;">${w2utils.lang('Save Search')}</span>
                <input class="search-name w2ui-input" placeholder="${w2utils.lang('Search name')}" style="width: 280px">
            </div>`,
            buttons: `
                <button id="grid-search-cancel" class="w2ui-btn">${w2utils.lang('Cancel')}</button>
                <button id="grid-search-save" class="w2ui-btn w2ui-btn-blue" ${String(value).trim() == '' ? 'disabled': ''}>${w2utils.lang('Save')}</button>
            `,
            onOpen(event) {
                setTimeout(() => {
                    $(this.box).find('#grid-search-cancel').on('click', () => {
                        grid.message()
                    })
                    $(this.box).find('#grid-search-save').on('click', () => {
                        let name = $(grid.box).find('.w2ui-message .search-name').val()
                        // save in savedSearches
                        if (grid.searchSelected) {
                            let ind = grid.savedSearches.findIndex(s => { return s.id == grid.searchSelected.name ? true : false })
                            Object.assign(grid.savedSearches[ind], {
                                id: name,
                                text: name,
                                logic: grid.last.logic,
                                data: $.extend(true, [], grid.searchData)
                            })
                        } else {
                            grid.savedSearches.push({
                                id: name,
                                text: name,
                                icon: 'w2ui-icon-search',
                                remove: true,
                                logic: grid.last.logic,
                                data: grid.searchData
                            })
                        }
                        // save local storage
                        if (w2utils.hasLocalStorage && grid.useLocalStorage) {
                            try {
                                let tmp = JSON.parse(localStorage.w2ui || '{}')
                                if (!tmp) tmp = {}
                                if (!tmp.searches) tmp.searches = {}
                                if (!Array.isArray(tmp.searches[(grid.stateId || grid.name)])) {
                                    tmp.searches[(grid.stateId || grid.name)] = []
                                }
                                let sdata = tmp.searches[(grid.stateId || grid.name)]
                                let ind = sdata.findIndex(s => { return s.name == grid.searchSelected.name ? true : false })
                                if (ind !== -1) {
                                    Object.assign(sdata[ind], {
                                        name,
                                        logic: grid.last.logic,
                                        data: grid.searchData
                                    })
                                } else {
                                    sdata.push({
                                        name,
                                        logic: grid.last.logic,
                                        data: grid.searchData
                                    })
                                }
                                localStorage.w2ui = JSON.stringify(tmp)
                            } catch (e) {
                                delete localStorage.w2ui
                                return null
                            }
                        }
                        grid.message()
                        // update on screen
                        if (grid.searchSelected) {
                            grid.searchSelected.name = name
                            $(grid.box).find(`#grid_${grid.name}_search_name .name-text`).html(name)
                        } else {
                            grid.searchSelected = {
                                name,
                                logic: grid.last.logic,
                                data: $.extend(true, [], grid.searchData)
                            }
                            $(grid.box).find(`#grid_${grid.name}_search_all`).val(' ').prop('readOnly', true)
                            $(grid.box).find(`#grid_${grid.name}_search_name`).show().find('.name-text').html(name)
                        }
                        edata.finish({ name })
                    })
                    let inputs = $(this.box).find('input, button')
                    inputs.off('.message')
                        .on('blur.message', function(evt) {
                            // last input
                            if (inputs.index(evt.target) + 1 === inputs.length) {
                                inputs.get(0).focus()
                                evt.preventDefault()
                            }
                        })
                        .on('keydown.message', function(evt) {
                            let val = String($(grid.box).find('.w2ui-message-body input').val()).trim()
                            if (evt.keyCode == 13 && val != '') $(grid.box).find('#grid-search-save').click() // enter
                            if (evt.keyCode == 27) grid.message() // esc
                        })
                    $(this.box).find('.w2ui-message-body input')
                        .on('input', function(event) {
                            let $save = $(this).closest('.w2ui-message').find('#grid-search-save')
                            if (String($(this).val()).trim() === '') {
                                $save.prop('disabled', true)
                            } else {
                                $save.prop('disabled', false)
                            }
                        })
                        .val(value)
                        .focus()
                }, 25)
            }
        })
    }
    searchReset(noRefresh) {
        let searchData        = []
        let hasHiddenSearches = false
        // add hidden searches
        for (let i = 0; i < this.searches.length; i++) {
            if (!this.searches[i].hidden || this.searches[i].value == null) continue
            searchData.push({
                field    : this.searches[i].field,
                operator : this.searches[i].operator || 'is',
                type     : this.searches[i].type,
                value    : this.searches[i].value || ''
            })
            hasHiddenSearches = true
        }
        // event before
        let edata = this.trigger('search', { reset: true, target: this.name, searchData: searchData })
        if (edata.isCancelled === true) return
        // default action
        this.searchData  = edata.detail.searchData
        this.searchSelected = null
        this.last.search = ''
        this.last.logic  = (hasHiddenSearches ? 'AND' : 'OR')
        // --- do not reset to All Fields (I think)
        if (this.searches.length > 0) {
            if (!this.multiSearch || !this.show.searchAll) {
                let tmp = 0
                while (tmp < this.searches.length && (this.searches[tmp].hidden || this.searches[tmp].simple === false)) tmp++
                if (tmp >= this.searches.length) {
                    // all searches are hidden
                    this.last.field = ''
                    this.last.label = ''
                } else {
                    this.last.field = this.searches[tmp].field
                    this.last.label = this.searches[tmp].label
                }
            } else {
                this.last.field = 'all'
                this.last.label = 'All Fields'
            }
        }
        this.last.multi      = false
        this.last.xhr_offset = 0
        // reset scrolling position
        this.last.scrollTop         = 0
        this.last.scrollLeft        = 0
        this.last.selection.indexes = []
        this.last.selection.columns = {}
        // -- clear all search field
        this.searchClose()
        $(this.box).find('#grid_'+ this.name +'_search_all').val('').removeData('selected')
        // apply search
        if (!noRefresh) this.reload()
        // event after
        edata.finish()
    }
    searchShowFields(forceHide) {
        if (forceHide === true) {
            w2tooltip.hide(this.name + '-search-fields')
            return
        }
        let items = []
        for (let s = -1; s < this.searches.length; s++) {
            let search   = this.searches[s]
            let sField   = (search ? search.field : null)
            let column   = this.getColumn(sField)
            let disabled = false
            let tooltip  = null
            if (this.show.searchHiddenMsg == true && s != -1
                    && (column == null || (column.hidden === true && column.hideable !== false))) {
                disabled = true
                tooltip = w2utils.lang(`This column ${column == null ? 'does not exist' : 'is hidden'}`)
            }
            if (s == -1) { // -1 is All Fields search
                if (!this.multiSearch || !this.show.searchAll) continue
                search = { field: 'all', label: 'All Fields' }
            } else {
                if (column != null && column.hideable === false) continue
                if (search.hidden === true) {
                    tooltip = w2utils.lang('This column is hidden')
                    // don't show hidden (not simple) searches
                    if (search.simple === false) continue
                }
            }
            if (search.label == null && search.caption != null) {
                console.log('NOTICE: grid search.caption property is deprecated, please use search.label. Search ->', search)
                search.label = search.caption
            }
            items.push({
                id: search.field,
                text: w2utils.lang(search.label),
                search,
                tooltip,
                disabled,
                checked: (search.field == this.last.field)
            })
        }
        w2menu.show({
            type: 'radio',
            name: this.name + '-search-fields',
            anchor: query(this.box).find('#grid_'+ this.name +'_search_name').parent().find('.w2ui-search-down').get(0),
            items,
            align: 'none',
            hideOn: ['doc-click']
        })
        .select(event => {
            this.searchInitInput(event.detail.item.search.field)
        })
    }
    searchInitInput(field, value) {
        let search
        let el = query(this.box).find('#grid_'+ this.name +'_search_all')
        if (field == 'all') {
            search = { field: 'all', label: w2utils.lang('All Fields') }
        } else {
            search = this.getSearch(field)
            if (search == null) return
        }
        // update field
        if (this.last.search != '') {
            this.last.label = search.label
            this.search(search.field, this.last.search)
        } else {
            this.last.field = search.field
            this.last.label = search.label
        }
        el.attr('placeholder', w2utils.lang('Search') + ' ' + w2utils.lang(search.label || search.caption || search.field, true))
    }
    // clears records and related params
    clear(noRefresh) {
        this.total           = 0
        this.records         = []
        this.summary         = []
        this.last.xhr_offset = 0 // need this for reload button to work on remote data set
        this.last.idCache    = {} // optimization to free memory
        this.reset(true)
        // refresh
        if (!noRefresh) this.refresh()
    }
    // clears scroll position, selection, ranges
    reset(noRefresh) {
        // position
        this.last.scrollTop   = 0
        this.last.scrollLeft  = 0
        this.last.selection   = { indexes: [], columns: {} }
        this.last.range_start = null
        this.last.range_end   = null
        // additional
        $(this.box).find('#grid_'+ this.name +'_records').prop('scrollTop', 0)
        // refresh
        if (!noRefresh) this.refresh()
    }
    skip(offset, callBack) {
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if (url) {
            this.offset = parseInt(offset)
            if (this.offset > this.total) this.offset = this.total - this.limit
            if (this.offset < 0 || !w2utils.isInt(this.offset)) this.offset = 0
            this.clear(true)
            this.reload(callBack)
        } else {
            console.log('ERROR: grid.skip() can only be called when you have remote data source.')
        }
    }
    load(url, callBack) {
        if (url == null) {
            console.log('ERROR: You need to provide url argument when calling .load() method of "'+ this.name +'" object.')
            return
        }
        // default action
        this.clear(true)
        this.request('get', {}, url, callBack)
    }
    reload(callBack) {
        let grid = this
        let url  = (typeof this.url != 'object' ? this.url : this.url.get)
        grid.selectionSave()
        if (url) {
            // need to remember selection (not just last.selection object)
            this.load(url, () => {
                grid.selectionRestore()
                if (typeof callBack == 'function') callBack()
            })
        } else {
            this.reset(true)
            this.localSearch()
            this.selectionRestore()
            if (typeof callBack == 'function') callBack({ status: 'success' })
        }
    }
    request(cmd, add_params, url, callBack) {
        if (add_params == null) add_params = {}
        if (url == '' || url == null) url = this.url
        if (url == '' || url == null) return
        // build parameters list
        if (!w2utils.isInt(this.offset)) this.offset = 0
        if (!w2utils.isInt(this.last.xhr_offset)) this.last.xhr_offset = 0
        // add list params
        let edata
        let params = {
            limit       : this.limit,
            offset      : parseInt(this.offset) + parseInt(this.last.xhr_offset),
            searchLogic : this.last.logic,
            search: this.searchData.map((search) => {
                let _search = $.extend({}, search)
                if (this.searchMap && this.searchMap[_search.field]) _search.field = this.searchMap[_search.field]
                return _search
            }),
            sort: this.sortData.map((sort) => {
                let _sort = $.extend({}, sort)
                if (this.sortMap && this.sortMap[_sort.field]) _sort.field = this.sortMap[_sort.field]
                return _sort
            })
        }
        if (this.searchData.length === 0) {
            delete params.search
            delete params.searchLogic
        }
        if (this.sortData.length === 0) {
            delete params.sort
        }
        // append other params
        $.extend(params, this.postData)
        $.extend(params, add_params)
        // other actions
        if (cmd == 'delete' || cmd == 'save') {
            delete params.limit
            delete params.offset
            params.action = cmd
            if (cmd == 'delete') {
                params[this.recid || 'recid'] = this.getSelection()
            }
        }
        // event before
        if (cmd == 'get') {
            edata = this.trigger('request', { target: this.name, url: url, postData: params, httpHeaders: this.httpHeaders })
            if (edata.isCancelled === true) { if (typeof callBack == 'function') callBack({ status: 'error', message: w2utils.lang('Request aborted.') }); return }
        } else {
            edata = { url: url, postData: params, httpHeaders: this.httpHeaders }
        }
        // call server to get data
        if (this.last.xhr_offset === 0) {
            this.lock(w2utils.lang(this.msgRefresh), true)
        }
        if (this.last.xhr) try { this.last.xhr.abort() } catch (e) {}
        // URL
        url = (typeof edata.detail.url != 'object' ? edata.detail.url : edata.detail.url.get)
        if (cmd == 'save' && typeof edata.detail.url == 'object') url = edata.detail.url.save
        if (cmd == 'delete' && typeof edata.detail.url == 'object') url = edata.detail.url.remove
        // process url with routeData
        if (!$.isEmptyObject(this.routeData)) {
            let info = w2utils.parseRoute(url)
            if (info.keys.length > 0) {
                for (let k = 0; k < info.keys.length; k++) {
                    if (this.routeData[info.keys[k].name] == null) continue
                    url = url.replace((new RegExp(':'+ info.keys[k].name, 'g')), this.routeData[info.keys[k].name])
                }
            }
        }
        // ajax options
        let ajaxOptions = {
            type     : 'GET',
            url      : url,
            data     : edata.detail.postData,
            headers  : edata.detail.httpHeaders,
            dataType : 'json' // expected data type from server
        }
        let dataType = this.dataType || w2utils.settings.dataType
        switch (dataType) {
            case 'HTTP':
                ajaxOptions.data = (typeof ajaxOptions.data == 'object' ? String($.param(ajaxOptions.data, false)).replace(/%5B/g, '[').replace(/%5D/g, ']') : ajaxOptions.data)
                break
            case 'HTTPJSON':
                ajaxOptions.data = { request: JSON.stringify(ajaxOptions.data) }
                break
            case 'RESTFULL':
                ajaxOptions.type = 'GET'
                if (cmd == 'save') ajaxOptions.type = 'PUT' // so far it is always update
                if (cmd == 'delete') ajaxOptions.type = 'DELETE'
                ajaxOptions.data = (typeof ajaxOptions.data == 'object' ? String($.param(ajaxOptions.data, false)).replace(/%5B/g, '[').replace(/%5D/g, ']') : ajaxOptions.data)
                break
            case 'RESTFULLJSON':
                ajaxOptions.type = 'GET'
                if (cmd == 'save') ajaxOptions.type = 'PUT' // so far it is always update
                if (cmd == 'delete') ajaxOptions.type = 'DELETE'
                ajaxOptions.data        = JSON.stringify(ajaxOptions.data)
                ajaxOptions.contentType = 'application/json'
                break
            case 'JSON':
                ajaxOptions.type        = 'POST'
                ajaxOptions.data        = JSON.stringify(ajaxOptions.data)
                ajaxOptions.contentType = 'application/json'
                break
        }
        if (this.method) ajaxOptions.type = this.method
        this.last.xhr_cmd   = cmd
        this.last.xhr_start = (new Date()).getTime()
        this.last.loaded    = false
        this.last.xhr       = $.ajax(ajaxOptions)
            .done((data, status, xhr) => {
                this.requestComplete(status, xhr, cmd, callBack)
            })
            .fail((xhr, status, error) => {
                // trigger event
                let errorObj = { status: status, error: error, rawResponseText: xhr.responseText }
                let edata2   = this.trigger('error', { error: errorObj, xhr: xhr })
                if (edata2.isCancelled === true) return
                // default behavior
                if (status != 'abort') { // it can be aborted by the grid itself
                    let data
                    try { data = typeof xhr.responseJSON === 'object' ? xhr.responseJSON : JSON.parse(xhr.responseText) } catch (e) {}
                    console.log('ERROR: Server communication failed.',
                        '\n   EXPECTED:', { status: 'success', total: 5, records: [{ recid: 1, field: 'value' }] },
                        '\n         OR:', { status: 'error', message: 'error message' },
                        '\n   RECEIVED:', typeof data == 'object' ? data : xhr.responseText)
                    this.requestComplete('error', xhr, cmd, callBack)
                }
                // event after
                edata2.finish()
            })
        if (cmd == 'get') {
            // event after
            edata.finish()
        }
    }
    requestComplete(status, xhr, cmd, callBack) {
        this.unlock()
        this.last.xhr_response = ((new Date()).getTime() - this.last.xhr_start)/1000
        setTimeout(() => {
            if (this.show.statusResponse) {
                this.status(w2utils.lang('Server Response ${count} seconds', {count: this.last.xhr_response}))
            }
        }, 10)
        this.last.pull_more    = false
        this.last.pull_refresh = true
        // event before
        let event_name = 'load'
        if (this.last.xhr_cmd == 'save') event_name = 'save'
        if (this.last.xhr_cmd == 'delete') event_name = 'delete'
        let edata = this.trigger(event_name, { target: this.name, xhr: xhr, status: status })
        if (edata.isCancelled === true) {
            if (typeof callBack == 'function') callBack({ status: 'error', message: w2utils.lang('Request aborted.') })
            return
        }
        // parse server response
        let data
        if (status != 'error') {
            // default action
            if (typeof this.parser == 'function') {
                data = this.parser(xhr.responseJSON)
                if (typeof data != 'object') {
                    console.log('ERROR: Your parser did not return proper object')
                }
            } else {
                data = xhr.responseJSON
                if (data == null) {
                    data = {
                        status       : 'error',
                        message      : w2utils.lang(this.msgNotJSON),
                        responseText : xhr.responseText
                    }
                } else if (Array.isArray(data)) {
                    // if it is plain array, assume these are records
                    data = {
                        status  : 'success',
                        records : data,
                        total   : data.length
                    }
                }
            }
            if (data.status == 'error') {
                this.error(data.message)
            } else if (cmd == 'get') {
                if (data.total == null) data.total = -1
                if (data.records == null) {
                    data.records = []
                }
                if (data.records.length == this.limit) {
                    let loaded            = this.records.length + data.records.length
                    this.last.xhr_hasMore = (loaded == this.total ? false : true)
                } else {
                    this.last.xhr_hasMore = false
                    this.total            = this.offset + this.last.xhr_offset + data.records.length
                }
                if (!this.last.xhr_hasMore) {
                    // if no more records, then hide spinner
                    $(this.box).find('#grid_'+ this.name +'_rec_more, #grid_'+ this.name +'_frec_more').hide()
                }
                if (this.last.xhr_offset === 0) {
                    this.records = []
                    this.summary = []
                } else {
                    if (data.total != -1 && parseInt(data.total) != parseInt(this.total)) {
                        let grid = this
                        this.message(w2utils.lang(this.msgNeedReload))
                            .ok(() => {
                                delete grid.last.xhr_offset
                                grid.reload()
                            })
                        return
                    }
                }
                if (w2utils.isInt(data.total)) this.total = parseInt(data.total)
                // records
                if (data.records) {
                    data.records.forEach(rec => {
                        if (this.recid) {
                            rec.recid = this.parseField(rec, this.recid)
                        }
                        if (rec.recid == null) {
                            rec.recid = 'recid-' + this.records.length
                        }
                        if (rec.w2ui && rec.w2ui.summary === true) {
                            this.summary.push(rec)
                        } else {
                            this.records.push(rec)
                        }
                    })
                }
                // summary records (if any)
                if (data.summary) {
                    this.summary = [] // reset summary with each call
                    data.summary.forEach(rec => {
                        if (this.recid) {
                            rec.recid = this.parseField(rec, this.recid)
                        }
                        if (rec.recid == null) {
                            rec.recid = 'recid-' + this.summary.length
                        }
                        this.summary.push(rec)
                    })
                }
            } else if (cmd == 'delete') {
                this.reset() // unselect old selections
                this.reload()
                return
            }
        } else {
            data = {
                status       : 'error',
                message      : w2utils.lang(this.msgAJAXerror),
                responseText : xhr.responseText
            }
            this.error(w2utils.lang(this.msgAJAXerror))
        }
        // event after
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if (!url) {
            this.localSort()
            this.localSearch()
        }
        this.total = parseInt(this.total)
        // do not refresh if loading on infinite scroll
        if (this.last.xhr_offset === 0) {
            this.refresh()
        } else {
            this.scroll()
            this.resize()
        }
        // call back
        if (typeof callBack == 'function') callBack(data) // need to be before event:after
        // after event
        edata.finish()
        this.last.loaded = true
    }
    error(msg) {
        // let the management of the error outside of the grid
        let edata = this.trigger('error', { target: this.name, message: msg , xhr: this.last.xhr })
        if (edata.isCancelled === true) {
            return
        }
        this.message(msg)
        // event after
        edata.finish()
    }
    getChanges(recordsBase) {
        let changes = []
        if (typeof recordsBase == 'undefined') {
            recordsBase = this.records
        }
        for (let r = 0; r < recordsBase.length; r++) {
            let rec = recordsBase[r]
            if (rec.w2ui) {
                if (rec.w2ui.changes != null) {
                    let obj                    = {}
                    obj[this.recid || 'recid'] = rec.recid
                    changes.push($.extend(true, obj, rec.w2ui.changes))
                }
                // recursively look for changes in non-expanded children
                if (rec.w2ui.expanded !== true && rec.w2ui.children && rec.w2ui.children.length) {
                    $.merge(changes, this.getChanges(rec.w2ui.children))
                }
            }
        }
        return changes
    }
    mergeChanges() {
        let changes = this.getChanges()
        for (let c = 0; c < changes.length; c++) {
            let record = this.get(changes[c][this.recid || 'recid'])
            for (let s in changes[c]) {
                if (s == 'recid' || (this.recid && s == this.recid)) continue // do not allow to change recid
                if (typeof changes[c][s] === 'object') changes[c][s] = changes[c][s].text
                try {
                    _setValue(record, s, changes[c][s])
                } catch (e) {
                    console.log('ERROR: Cannot merge. ', e.message || '', e)
                }
                if (record.w2ui) delete record.w2ui.changes
            }
        }
        this.refresh()
        function _setValue(obj, field, value) {
            let fld = field.split('.')
            if (fld.length == 1) {
                obj[field] = value
            } else {
                obj = obj[fld[0]]
                fld.shift()
                _setValue(obj, fld.join('.'), value)
            }
        }
    }
    save(callBack) {
        let changes = this.getChanges()
        let url     = (typeof this.url != 'object' ? this.url : this.url.save)
        // event before
        let edata = this.trigger('save', { target: this.name, changes: changes })
        if (edata.isCancelled === true) {
            if (url && typeof callBack == 'function') callBack({ status: 'error', message: w2utils.lang('Request aborted.') })
            return
        }
        if (url) {
            this.request('save', { 'changes' : edata.detail.changes }, null,
                (data) => {
                    if (data.status !== 'error') {
                        // only merge changes, if save was successful
                        this.mergeChanges()
                    }
                    // event after
                    edata.finish()
                    // call back
                    if (typeof callBack == 'function') callBack(data)
                }
            )
        } else {
            this.mergeChanges()
            // event after
            edata.finish()
        }
    }
    editField(recid, column, value, event) {
        let obj = this, index, input
        if (this.last.inEditMode === true) { // already editing
            if (event && event.keyCode == 13) {
                index  = this.last._edit.index
                column = this.last._edit.column
                recid  = this.last._edit.recid
                this.editChange({ type: 'custom', value: this.last._edit.value }, this.get(recid, true), column, event)
                if (this.advanceOnEdit) {
                    let next = event.shiftKey ? this.prevRow(index, column, 1) : this.nextRow(index, column, 1)
                    if (next != null && next != index) {
                        setTimeout(() => {
                            if (this.selectType != 'row') {
                                this.selectNone()
                                this.select({ recid: this.records[next].recid, column: column })
                            } else {
                                this.editField(this.records[next].recid, column, null, event)
                            }
                        }, 1)
                    }
                }
                this.last.inEditMode = false
            } else {
                // when 2 chars entered fast
                let $input = $(this.box).find('div.w2ui-edit-box .w2ui-input')
                if ($input.length > 0 && $input[0].tagName == 'DIV') {
                    $input.text($input.text() + value)
                    w2utils.setCursorPosition($input[0], $input.text().length)
                }
            }
            return
        }
        index    = this.get(recid, true)
        let edit = this.getCellEditable(index, column)
        if (!edit) return
        let rec    = this.records[index]
        let col    = this.columns[column]
        let prefix = (col.frozen === true ? '_f' : '_')
        if (['enum', 'file'].indexOf(edit.type) != -1) {
            console.log('ERROR: input types "enum" and "file" are not supported in inline editing.')
            return
        }
        // event before
        let edata = this.trigger('editField', { target: this.name, recid: recid, column: column, value: value,
            index: index, originalEvent: event })
        if (edata.isCancelled === true) return
        value = edata.detail.value
        // default behaviour
        this.last.inEditMode = true
        this.last._edit      = { value: value, index: index, column: column, recid: recid }
        this.selectNone()
        this.select({ recid: recid, column: column })
        if (['checkbox', 'check'].indexOf(edit.type) != -1) return
        // create input element
        let tr = $(this.box).find('#grid_'+ this.name + prefix +'rec_' + w2utils.escapeId(recid))
        let el = tr.find('[col='+ column +'] > div')
        // clear previous if any
        $(this.box).find('div.w2ui-edit-box').remove()
        // for spreadsheet - insert into selection
        if (this.selectType != 'row') {
            $(this.box).find('#grid_'+ this.name + prefix + 'selection')
                .attr('id', 'grid_'+ this.name + '_editable')
                .removeClass('w2ui-selection')
                .addClass('w2ui-edit-box')
                .prepend('<div style="position: absolute; top: 0px; bottom: 0px; left: 0px; right: 0px;"></div>')
                .find('.w2ui-selection-resizer')
                .remove()
            el = $(this.box).find('#grid_'+ this.name + '_editable >div:first-child')
        }
        if (edit.inTag == null) edit.inTag = ''
        if (edit.outTag == null) edit.outTag = ''
        if (edit.style == null) edit.style = ''
        if (edit.items == null) edit.items = []
        let val = (rec.w2ui && rec.w2ui.changes && rec.w2ui.changes[col.field] != null
            ? w2utils.stripTags(rec.w2ui.changes[col.field])
            : w2utils.stripTags(obj.parseField(rec, col.field)))
        if (val == null) val = ''
        let old_value = (typeof val != 'object' ? val : '')
        if (edata.detail.old_value != null) old_value = edata.detail.old_value
        if (value != null) val = value
        let addStyle = (col.style != null ? col.style + ';' : '')
        if (typeof col.render == 'string' && ['number', 'int', 'float', 'money', 'percent', 'size'].indexOf(col.render.split(':')[0]) != -1) {
            addStyle += 'text-align: right;'
        }
        // normalize items
        if (edit.items.length > 0 && !$.isPlainObject(edit.items[0])) {
            edit.items = w2utils.normMenu(edit.items)
        }
        switch (edit.type) {
            case 'select': {
                let html = ''
                for (let i = 0; i < edit.items.length; i++) {
                    html += '<option value="'+ edit.items[i].id +'"'+ (edit.items[i].id == val ? ' selected="selected"' : '') +'>'+ edit.items[i].text +'</option>'
                }
                el.addClass('w2ui-editable')
                    .html('<select id="grid_'+ this.name +'_edit_'+ recid +'_'+ column +'" column="'+ column +'" class="w2ui-input"'+
                        '    style="width: 100%; pointer-events: auto; padding: 0 0 0 3px; margin: 0px; border-left: 0; border-right: 0; border-radius: 0px; '+
                        '           outline: none; font-family: inherit;'+ addStyle + edit.style +'" '+
                        '    field="'+ col.field +'" recid="'+ recid +'" '+
                        '    '+ edit.inTag +
                        '>'+ html +'</select>' + edit.outTag)
                setTimeout(() => {
                    el.find('select')
                        .on('change', function(event) {
                            delete obj.last.move
                        })
                        .on('blur', function(event) {
                            if ($(this).data('keep-open') == true) return
                            obj.editChange.call(obj, this, index, column, event)
                        })
                }, 10)
                break
            }
            case 'div': {
                let $tmp = tr.find('[col='+ column +'] > div')
                let font = 'font-family: '+ $tmp.css('font-family') + '; font-size: '+ $tmp.css('font-size') + ';'
                el.addClass('w2ui-editable')
                    .html('<div id="grid_'+ this.name +'_edit_'+ recid +'_'+ column +'" class="w2ui-input"'+
                        '    contenteditable style="'+ font + addStyle + edit.style +'" autocorrect="off" autocomplete="off" spellcheck="false" '+
                        '    field="'+ col.field +'" recid="'+ recid +'" column="'+ column +'" '+ edit.inTag +
                        '></div>' + edit.outTag)
                if (value == null) el.find('div.w2ui-input').text(typeof val != 'object' ? val : '')
                // add blur listener
                input = el.find('div.w2ui-input').get(0)
                setTimeout(() => {
                    let tmp = input
                    $(tmp).on('blur', function(event) {
                        if ($(this).data('keep-open') == true) return
                        obj.editChange.call(obj, tmp, index, column, event)
                    })
                }, 10)
                if (value != null) $(input).text(typeof val != 'object' ? val : '')
                break
            }
            default: {
                let $tmp = tr.find('[col='+ column +'] > div')
                let font = 'font-family: '+ $tmp.css('font-family') + '; font-size: '+ $tmp.css('font-size')
                el.addClass('w2ui-editable')
                    .html('<input id="grid_'+ this.name +'_edit_'+ recid +'_'+ column +'" autocorrect="off" autocomplete="off" spellcheck="false" type="text" '+
                        '    style="'+ font +'; '+ addStyle + edit.style +'" '+
                        '    field="'+ col.field +'" recid="'+ recid +'" column="'+ column +'" class="w2ui-input"'+ edit.inTag +
                        '/>' + edit.outTag)
                // issue #499
                if (edit.type == 'number') {
                    val = w2utils.formatNumber(val)
                }
                if (edit.type == 'date') {
                    val = w2utils.formatDate(w2utils.isDate(val, edit.format, true) || new Date(), edit.format)
                }
                if (value == null) el.find('input').val(typeof val != 'object' ? val : '')
                // init w2field
                input = el.find('input').get(0)
                if ($.fn.w2field) {
                    $(input).w2field(edit.type, $.extend(edit, { selected: val }))
                }
                // add blur listener
                setTimeout(() => {
                    let tmp = input
                    if (edit.type == 'list') {
                        tmp = $($(input).data('w2field').helpers.focus).find('input')
                        if (typeof val != 'object' && val != '') tmp.val(val).css({ opacity: 1 }).prev().css({ opacity: 1 })
                        el.find('input').on('change', function(event) {
                            obj.editChange.call(obj, input, index, column, event)
                        })
                    }
                    $(tmp).on('blur', function(event) {
                        if ($(this).data('keep-open') == true) return
                        obj.editChange.call(obj, input, index, column, event)
                    })
                }, 10)
                if (value != null) $(input).val(typeof val != 'object' ? val : '')
                input.select()
            }
        }
        setTimeout(() => {
            if (!input) input = el.find('input').get(0)
            if (!this.last.inEditMode) return
            el.find('input, select, div.w2ui-input')
                .data('old_value', old_value)
                .on('mousedown', function(event) {
                    event.stopPropagation()
                })
                .on('click', function(event) {
                    if (edit.type == 'div') {
                        expand.call(el.find('div.w2ui-input')[0], null)
                    } else {
                        expand.call(el.find('input, select')[0], null)
                    }
                })
                .on('paste', function(event) {
                    // clean paste to be plain text
                    let e = event.originalEvent
                    event.preventDefault()
                    let text = e.clipboardData.getData('text/plain')
                    document.execCommand('insertHTML', false, text)
                })
                .on('keydown', function(event) {
                    let el  = this
                    let val = (el.tagName.toUpperCase() == 'DIV' ? $(el).text() : $(el).val())
                    switch (event.keyCode) {
                        case 8: // backspace;
                            if (edit.type == 'list' && !$(input).data('w2field')) { // cancel backspace when deleting element
                                event.preventDefault()
                            }
                            break
                        case 9:
                        case 13:
                            event.preventDefault()
                            break
                        case 27: // esc button exits edit mode, but if in a popup, it will also close the popup, hence
                            event.stopPropagation()
                            break
                        case 37:
                            if (w2utils.getCursorPosition(el) === 0) {
                                event.preventDefault()
                            }
                            break
                        case 39:
                            if (w2utils.getCursorPosition(el) == val.length) {
                                w2utils.setCursorPosition(el, val.length)
                                event.preventDefault()
                            }
                            break
                    }
                    // need timeout so, this handler is executed last
                    setTimeout(() => {
                        switch (event.keyCode) {
                            case 9: { // tab
                                let next = event.shiftKey
                                    ? obj.prevCell(index, column, true)
                                    : obj.nextCell(index, column, true)
                                if (next != null) {
                                    let recid = obj.records[next.index].recid
                                    el.blur()
                                    setTimeout(() => {
                                        if (obj.selectType != 'row') {
                                            obj.selectNone()
                                            obj.select({ recid, column: next.colIndex })
                                        } else {
                                            obj.editField(recid, next.colIndex, null, event)
                                        }
                                    }, 1)
                                    if (event.preventDefault) event.preventDefault()
                                }
                                break
                            }
                            case 13: { // enter
                                el.blur()
                                if (obj.advanceOnEdit) {
                                    let next = event.shiftKey ? obj.prevRow(index, column, 1) : obj.nextRow(index, column, 1)
                                    if (next == null) next = index // keep the same
                                    setTimeout(() => {
                                        if (obj.selectType != 'row') {
                                            obj.selectNone()
                                            obj.select({ recid: obj.records[next].recid, column: column })
                                        } else {
                                            obj.editField(obj.records[next].recid, column, null, event)
                                        }
                                    }, 1)
                                }
                                if (el.tagName.toUpperCase() == 'DIV') {
                                    event.preventDefault()
                                }
                                break
                            }
                            case 27: { // escape
                                let old = obj.parseField(rec, col.field)
                                if (rec.w2ui && rec.w2ui.changes && rec.w2ui.changes[col.field] != null) old = rec.w2ui.changes[col.field]
                                if ($(el).data('old_value') != null) old = $(el).data('old_value')
                                if (el.tagName.toUpperCase() == 'DIV') {
                                    $(el).text(old != null ? old : '')
                                } else {
                                    el.value = old != null ? old : ''
                                }
                                el.blur()
                                setTimeout(() => { obj.select({ recid: recid, column: column }) }, 1)
                                break
                            }
                        }
                        // if input too small - expand
                        expand.call(el, event)
                    }, 1)
                })
                .on('keyup', function(event) {
                    expand.call(this, event)
                })
            // focus and select
            setTimeout(() => {
                if (!obj.last.inEditMode) return
                let tmp = el.find('.w2ui-input')
                let len = ($(tmp).val() != null ? $(tmp).val().length : 0)
                if (edit.type == 'div') len = $(tmp).text().length
                if (tmp.length > 0) {
                    tmp.focus()
                    clearTimeout(obj.last.kbd_timer) // keep focus
                    if (tmp[0].tagName.toUpperCase() != 'SELECT') w2utils.setCursorPosition(tmp[0], len)
                    tmp[0].resize = expand
                    expand.call(tmp[0], null)
                }
            }, 50)
            // event after
            edata.finish({ input: el.find('input, select, div.w2ui-input') })
        }, 5) // needs to be 5-10
        return
        function expand(event) {
            try {
                let val   = (this.tagName.toUpperCase() == 'DIV' ? $(this).text() : this.value)
                let $sel  = $(obj.box).find('#grid_'+ obj.name + '_editable')
                let style = 'font-family: '+ $(this).css('font-family') + '; font-size: '+ $(this).css('font-size') + '; white-space: pre;'
                let width = w2utils.getStrWidth(val, style)
                if (width + 20 > $sel.width()) {
                    $sel.width(width + 20)
                }
            } catch (e) {
            }
        }
    }
    editChange(el, index, column, event) {
        // keep focus
        setTimeout(() => {
            let $input = $(this.box).find('#grid_'+ this.name + '_focus')
            if (!$input.is(':focus')) $input.focus()
        }, 10)
        // all other fields
        let summary = index < 0
        index       = index < 0 ? -index - 1 : index
        let records = summary ? this.summary : this.records
        let rec     = records[index]
        let col     = this.columns[column]
        let tr      = $(this.box).find('#grid_'+ this.name + (col.frozen === true ? '_frec_' : '_rec_') + w2utils.escapeId(rec.recid))
        let new_val = (el.tagName && el.tagName.toUpperCase() == 'DIV' ? $(el).text() : el.value)
        let tmp     = $(el).data('w2field')
        if (tmp) {
            if (tmp.type == 'list') new_val = $(el).data('selected')
            if ($.isEmptyObject(new_val) || new_val == null) new_val = ''
            if (!$.isPlainObject(new_val)) new_val = tmp.clean(new_val)
        }
        if (el.type == 'checkbox') {
            if (rec.w2ui && rec.w2ui.editable === false) el.checked = !el.checked
            new_val = el.checked
        }
        let old_val = this.parseField(rec, col.field)
        let prev_val = (rec.w2ui && rec.w2ui.changes && rec.w2ui.changes.hasOwnProperty(col.field) ? rec.w2ui.changes[col.field]: old_val)
        // change/restore event
        let edata = {
            target: this.name, input_id: el.id, recid: rec.recid, index: index, column: column,
            originalEvent: (event.originalEvent ? event.originalEvent : event),
            value_new: new_val,
            value_previous: prev_val,
            value_original: old_val
        }
        if ($(event.target).data('old_value') != null) edata.value_previous = $(event.target).data('old_value')
        // if (old_val == null) old_val = ''; -- do not uncomment, error otherwise
        while (true) {
            new_val = edata.value_new
            if ((typeof new_val != 'object' && String(old_val) != String(new_val)) ||
                (typeof new_val == 'object' && new_val && new_val.id != old_val && (typeof old_val != 'object' || old_val == null || new_val.id != old_val.id))) {
                // change event
                edata = this.trigger('change', edata)
                if (edata.isCancelled !== true) {
                    if (new_val !== edata.value_new) {
                        // re-evaluate the type of change to be made
                        continue
                    }
                    // default action
                    if ((edata.value_new === '' || edata.value_new == null) && (prev_val === '' || prev_val == null)) {
                        // value did not change, was empty is empty
                    } else {
                        rec.w2ui = rec.w2ui ?? {}
                        rec.w2ui.changes = rec.w2ui.changes ?? {}
                        rec.w2ui.changes[col.field] = edata.value_new
                    }
                    // event after
                    edata.finish()
                }
            } else {
                // restore event
                edata = this.trigger('restore', edata)
                if (edata.isCancelled !== true) {
                    if (new_val !== edata.value_new) {
                        // re-evaluate the type of change to be made
                        continue
                    }
                    // default action
                    if (rec.w2ui && rec.w2ui.changes) delete rec.w2ui.changes[col.field]
                    if (rec.w2ui && $.isEmptyObject(rec.w2ui.changes)) delete rec.w2ui.changes
                    // event after
                    edata.finish()
                }
            }
            break
        }
        // refresh cell
        let cell = $(tr).find('[col='+ column +']')
        if (!summary) {
            if (rec.w2ui && rec.w2ui.changes && rec.w2ui.changes[col.field] != null) {
                cell.addClass('w2ui-changed')
            } else {
                cell.removeClass('w2ui-changed')
            }
            // update cell data
            cell.replaceWith(this.getCellHTML(index, column, summary))
        }
        // remove
        $(this.box).find('div.w2ui-edit-box').remove()
        this.last.inEditMode = false
        this.updateToolbar()
    }
    'delete'(force) {
        // event before
        let edata = this.trigger('delete', { target: this.name, force: force })
        if (force) this.message() // close message
        if (edata.isCancelled === true) return
        force = edata.detail.force
        // default action
        let recs = this.getSelection()
        if (recs.length === 0) return
        if (this.msgDelete != '' && !force) {
            this.confirm({
                text: w2utils.lang(this.msgDelete, {
                    count: recs.length,
                    records: w2utils.lang( recs.length == 1 ? 'record' : 'records')
                }),
                width: 380,
                height: 170,
                yes_text: 'Delete',
                yes_class: 'w2ui-btn-red',
                no_text: 'Cancel',
            })
            .yes(event => {
                event.detail.self.close()
                this.delete(true)
            })
            .no(event => {
                event.detail.self.close()
            })
            return
        }
        // call delete script
        let url = (typeof this.url != 'object' ? this.url : this.url.remove)
        if (url) {
            this.request('delete')
        } else {
            if (typeof recs[0] != 'object') {
                this.selectNone()
                this.remove.apply(this, recs)
            } else {
                // clear cells
                for (let r = 0; r < recs.length; r++) {
                    let fld = this.columns[recs[r].column].field
                    let ind = this.get(recs[r].recid, true)
                    let rec = this.records[ind]
                    if (ind != null && fld != 'recid') {
                        this.records[ind][fld] = ''
                        if (rec.w2ui && rec.w2ui.changes) delete rec.w2ui.changes[fld]
                        // -- style should not be deleted
                        // if (rec.style != null && $.isPlainObject(rec.style) && rec.style[recs[r].column]) {
                        //     delete rec.style[recs[r].column];
                        // }
                    }
                }
                this.update()
            }
        }
        // event after
        edata.finish()
    }
    click(recid, event) {
        let time   = (new Date()).getTime()
        let column = null
        if (this.last.cancelClick == true || (event && event.altKey)) return
        if ((typeof recid == 'object') && (recid !== null)) {
            column = recid.column
            recid  = recid.recid
        }
        if (event == null) event = {}
        // check for double click
        if (time - parseInt(this.last.click_time) < 350 && this.last.click_recid == recid && event.type == 'click') {
            this.dblClick(recid, event)
            return
        }
        // hide bubble
        if (this.last.bubbleEl) {
            this.last.bubbleEl = null
        }
        this.last.click_time  = time
        let last_recid        = this.last.click_recid
        this.last.click_recid = recid
        // column user clicked on
        if (column == null && event.target) {
            let tmp = event.target
            if (tmp.tagName.toUpperCase() != 'TD') tmp = $(tmp).parents('td')[0]
            if ($(tmp).attr('col') != null) column = parseInt($(tmp).attr('col'))
        }
        // event before
        let edata = this.trigger('click', { target: this.name, recid: recid, column: column, originalEvent: event })
        if (edata.isCancelled === true) return
        // default action
        let sel = this.getSelection()
        $(this.box).find('#grid_'+ this.name +'_check_all').prop('checked', false)
        let ind             = this.get(recid, true)
        let selectColumns   = []
        this.last.sel_ind   = ind
        this.last.sel_col   = column
        this.last.sel_recid = recid
        this.last.sel_type  = 'click'
        // multi select with shift key
        let start, end, t1, t2
        if (event.shiftKey && sel.length > 0 && this.multiSelect) {
            if (sel[0].recid) {
                start = this.get(sel[0].recid, true)
                end   = this.get(recid, true)
                if (column > sel[0].column) {
                    t1 = sel[0].column
                    t2 = column
                } else {
                    t1 = column
                    t2 = sel[0].column
                }
                for (let c = t1; c <= t2; c++) selectColumns.push(c)
            } else {
                start = this.get(last_recid, true)
                end   = this.get(recid, true)
            }
            let sel_add = []
            if (start > end) { let tmp = start; start = end; end = tmp }
            let url = (typeof this.url != 'object' ? this.url : this.url.get)
            for (let i = start; i <= end; i++) {
                if (this.searchData.length > 0 && !url && $.inArray(i, this.last.searchIds) == -1) continue
                if (this.selectType == 'row') {
                    sel_add.push(this.records[i].recid)
                } else {
                    for (let sc = 0; sc < selectColumns.length; sc++) {
                        sel_add.push({ recid: this.records[i].recid, column: selectColumns[sc] })
                    }
                }
                //sel.push(this.records[i].recid);
            }
            this.select(sel_add)
        } else {
            let last    = this.last.selection
            let flag    = (last.indexes.indexOf(ind) != -1 ? true : false)
            let fselect = false
            // if clicked on the checkbox
            if ($(event.target).parents('td').hasClass('w2ui-col-select')) fselect = true
            // clear other if necessary
            if (((!event.ctrlKey && !event.shiftKey && !event.metaKey && !fselect) || !this.multiSelect) && !this.showSelectColumn) {
                if (this.selectType != 'row' && $.inArray(column, last.columns[ind]) == -1) flag = false
                if (sel.length > 300) this.selectNone(); else this.unselect(sel)
                if (flag === true && sel.length == 1) {
                    this.unselect({ recid: recid, column: column })
                } else {
                    this.select({ recid: recid, column: column })
                }
            } else {
                let isChecked = $(event.target).parents('tr').find('.w2ui-grid-select-check').is(':checked')
                if (this.selectType != 'row' && $.inArray(column, last.columns[ind]) == -1 && !isChecked) flag = false
                if (flag === true) {
                    this.unselect({ recid: recid, column: column })
                } else {
                    this.select({ recid: recid, column: column })
                }
            }
        }
        this.status()
        this.initResize()
        // event after
        edata.finish()
    }
    columnClick(field, event) {
        // ignore click if column was resized
        if (this.last.colResizing === true) {
            return
        }
        // event before
        let edata = this.trigger('columnClick', { target: this.name, field: field, originalEvent: event })
        if (edata.isCancelled === true) return
        // default behaviour
        if (this.selectType == 'row') {
            let column = this.getColumn(field)
            if (column && column.sortable) this.sort(field, null, (event && (event.ctrlKey || event.metaKey) ? true : false))
            if (edata.detail.field == 'line-number') {
                if (this.getSelection().length >= this.records.length) {
                    this.selectNone()
                } else {
                    this.selectAll()
                }
            }
        } else {
            if (event.altKey){
                let column = this.getColumn(field)
                if (column && column.sortable) this.sort(field, null, (event && (event.ctrlKey || event.metaKey) ? true : false))
            }
            // select entire column
            if (edata.detail.field == 'line-number') {
                if (this.getSelection().length >= this.records.length) {
                    this.selectNone()
                } else {
                    this.selectAll()
                }
            } else {
                if (!event.shiftKey && !event.metaKey && !event.ctrlKey) {
                    this.selectNone()
                }
                let tmp    = this.getSelection()
                let column = this.getColumn(edata.detail.field, true)
                let sel    = []
                let cols   = []
                // check if there was a selection before
                if (tmp.length != 0 && event.shiftKey) {
                    let start = column
                    let end   = tmp[0].column
                    if (start > end) {
                        start = tmp[0].column
                        end   = column
                    }
                    for (let i = start; i<=end; i++) cols.push(i)
                } else {
                    cols.push(column)
                }
                edata = this.trigger('columnSelect', { target: this.name, columns: cols })
                if (edata.isCancelled !== true) {
                    for (let i = 0; i < this.records.length; i++) {
                        sel.push({ recid: this.records[i].recid, column: cols })
                    }
                    this.select(sel)
                }
                this.trigger($.extend(edata, { phase: 'after' }))
            }
        }
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
    }
    columnDblClick(field, event) {
        // event before
        let edata = this.trigger({ phase: 'before', type: 'columnDblClick', target: this.name, field: field, originalEvent: event })
        if (edata.isCancelled === true) return
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
    }
    focus(event) {
        // event before
        let edata = this.trigger({ phase: 'before', type: 'focus', target: this.name, originalEvent: event })
        if (edata.isCancelled === true) return false
        // default behaviour
        this.hasFocus = true
        $(this.box).removeClass('w2ui-inactive').find('.w2ui-inactive').removeClass('w2ui-inactive')
        setTimeout(() => {
            let $input = $(this.box).find('#grid_'+ this.name + '_focus')
            if (!$input.is(':focus')) $input.focus()
        }, 10)
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
    }
    blur(event) {
        // event before
        let edata = this.trigger({ phase: 'before', type: 'blur', target: this.name, originalEvent: event })
        if (edata.isCancelled === true) return false
        // default behaviour
        this.hasFocus = false
        $(this.box).addClass('w2ui-inactive').find('.w2ui-selected').addClass('w2ui-inactive')
        $(this.box).find('.w2ui-selection').addClass('w2ui-inactive')
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
    }
    keydown(event) {
        // this method is called from w2utils
        let obj = this
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if (obj.keyboard !== true) return
        // trigger event
        let edata = obj.trigger({ phase: 'before', type: 'keydown', target: obj.name, originalEvent: event })
        if (edata.isCancelled === true) return
        // default behavior
        if ($(this.box).find('>.w2ui-message').length > 0) {
            // if there are messages
            if (event.keyCode == 27) this.message()
            return
        }
        let empty   = false
        let records = $(obj.box).find('#grid_'+ obj.name +'_records')
        let sel     = obj.getSelection()
        if (sel.length === 0) empty = true
        let recid   = sel[0] || null
        let columns = []
        let recid2  = sel[sel.length-1]
        if (typeof recid == 'object' && recid != null) {
            recid   = sel[0].recid
            columns = []
            let ii  = 0
            while (true) {
                if (!sel[ii] || sel[ii].recid != recid) break
                columns.push(sel[ii].column)
                ii++
            }
            recid2 = sel[sel.length-1].recid
        }
        let ind      = obj.get(recid, true)
        let ind2     = obj.get(recid2, true)
        let recEL    = $(obj.box).find(`#grid_${obj.name}_rec_${(ind != null ? w2utils.escapeId(obj.records[ind].recid) : 'none')}`)
        let pageSize = Math.floor($(obj.box).find(`#grid_${obj.name}_records`).height() / obj.recordHeight)
        let cancel   = false
        let key      = event.keyCode
        let shiftKey = event.shiftKey
        switch (key) {
            case 8: // backspace
            case 46: // delete
                // delete if button is visible
                obj.delete()
                cancel = true
                event.stopPropagation()
                break
            case 27: // escape
                obj.selectNone()
                cancel = true
                break
            case 65: // cmd + A
                if (!event.metaKey && !event.ctrlKey) break
                obj.selectAll()
                cancel = true
                break
            case 13: // enter
                // if expandable columns - expand it
                if (this.selectType == 'row' && obj.show.expandColumn === true) {
                    if (recEL.length <= 0) break
                    obj.toggle(recid, event)
                    cancel = true
                } else { // or enter edit
                    for (let c = 0; c < this.columns.length; c++) {
                        let edit = this.getCellEditable(ind, c)
                        if (edit) {
                            columns.push(parseInt(c))
                            break
                        }
                    }
                    // edit last column that was edited
                    if (this.selectType == 'row' && this.last._edit && this.last._edit.column) {
                        columns = [this.last._edit.column]
                    }
                    if (columns.length > 0) {
                        obj.editField(recid, columns[0], null, event)
                        cancel = true
                    }
                }
                break
            case 37: // left
                moveLeft()
                break
            case 39: // right
                moveRight()
                break
            case 33: // <PgUp>
                moveUp(pageSize)
                break
            case 34: // <PgDn>
                moveDown(pageSize)
                break
            case 35: // <End>
                moveDown(-1)
                break
            case 36: // <Home>
                moveUp(-1)
                break
            case 38: // up
                // ctrl (or cmd) + up -> same as home
                moveUp(event.metaKey || event.ctrlKey ? -1 : 1)
                break
            case 40: // down
                // ctrl (or cmd) + up -> same as end
                moveDown(event.metaKey || event.ctrlKey ? -1 : 1)
                break
            // copy & paste
            case 17: // ctrl key
            case 91: // cmd key
                // SLOW: 10k records take 7.0
                if (empty) break
                // in Safari need to copy to buffer on cmd or ctrl key (otherwise does not work)
                if (w2utils.isSafari) {
                    obj.last.copy_event = obj.copy(false, event)
                    $(obj.box).find('#grid_'+ obj.name + '_focus').val(obj.last.copy_event.text).select()
                }
                break
            case 67: // - c
                // this fill trigger event.onComplete
                if (event.metaKey || event.ctrlKey) {
                    if (w2utils.isSafari) {
                        obj.copy(obj.last.copy_event, event)
                    } else {
                        obj.last.copy_event = obj.copy(false, event)
                        $(obj.box).find('#grid_'+ obj.name + '_focus').val(obj.last.copy_event.text).select()
                        obj.copy(obj.last.copy_event, event)
                    }
                }
                break
            case 88: // x - cut
                if (empty) break
                if (event.ctrlKey || event.metaKey) {
                    if (w2utils.isSafari) {
                        obj.copy(obj.last.copy_event, event)
                    } else {
                        obj.last.copy_event = obj.copy(false, event)
                        $(obj.box).find('#grid_'+ obj.name + '_focus').val(obj.last.copy_event.text).select()
                        obj.copy(obj.last.copy_event, event)
                    }
                }
                break
        }
        let tmp = [32, 187, 189, 192, 219, 220, 221, 186, 222, 188, 190, 191] // other typeable chars
        for (let i = 48; i<=111; i++) tmp.push(i) // 0-9,a-z,A-Z,numpad
        if (tmp.indexOf(key) != -1 && !event.ctrlKey && !event.metaKey && !cancel) {
            if (columns.length === 0) columns.push(0)
            cancel = false
            // move typed key into edit
            setTimeout(() => {
                let focus = $(obj.box).find('#grid_'+ obj.name + '_focus')
                let key   = focus.val()
                focus.val('')
                obj.editField(recid, columns[0], key, event)
            }, 1)
        }
        if (cancel) { // cancel default behaviour
            if (event.preventDefault) event.preventDefault()
        }
        // event after
        obj.trigger($.extend(edata, { phase: 'after' }))
        function moveLeft() {
            if (empty) { // no selection
                selectTopRecord()
                return
            }
            if (obj.selectType == 'row') {
                if (recEL.length <= 0) return
                let tmp = obj.records[ind].w2ui || {}
                if (tmp && tmp.parent_recid != null && (!Array.isArray(tmp.children) || tmp.children.length === 0 || !tmp.expanded)) {
                    obj.unselect(recid)
                    obj.collapse(tmp.parent_recid, event)
                    obj.select(tmp.parent_recid)
                } else {
                    obj.collapse(recid, event)
                }
            } else {
                let prev = obj.prevCell(ind, columns[0])
                if (prev.index != ind) {
                    prev = null
                } else {
                    prev = prev.colIndex
                }
                if (!shiftKey && prev == null) {
                    obj.selectNone()
                    prev = 0
                }
                if (prev != null) {
                    if (shiftKey && obj.multiSelect) {
                        if (tmpUnselect()) return
                        let tmp    = []
                        let newSel = []
                        let unSel  = []
                        if (columns.indexOf(obj.last.sel_col) === 0 && columns.length > 1) {
                            for (let i = 0; i < sel.length; i++) {
                                if (tmp.indexOf(sel[i].recid) == -1) tmp.push(sel[i].recid)
                                unSel.push({ recid: sel[i].recid, column: columns[columns.length-1] })
                            }
                            obj.unselect(unSel)
                            obj.scrollIntoView(ind, columns[columns.length-1], true)
                        } else {
                            for (let i = 0; i < sel.length; i++) {
                                if (tmp.indexOf(sel[i].recid) == -1) tmp.push(sel[i].recid)
                                newSel.push({ recid: sel[i].recid, column: prev })
                            }
                            obj.select(newSel)
                            obj.scrollIntoView(ind, prev, true)
                        }
                    } else {
                        event.metaKey = false
                        obj.click({ recid: recid, column: prev }, event)
                        obj.scrollIntoView(ind, prev, true)
                    }
                } else {
                    // if selected more then one, then select first
                    if (!shiftKey) {
                        if (sel.length > 1) {
                            obj.selectNone()
                        } else {
                            for (let s = 1; s < sel.length; s++) obj.unselect(sel[s])
                        }
                    }
                }
            }
            cancel = true
        }
        function moveRight() {
            if (empty) {
                selectTopRecord()
                return
            }
            if (obj.selectType == 'row') {
                if (recEL.length <= 0) return
                obj.expand(recid, event)
            } else {
                let next = obj.nextCell(ind, columns[columns.length-1]) // columns is an array of selected columns
                if (next.index != ind) {
                    next = null
                } else {
                    next = next.colIndex
                }
                if (!shiftKey && next == null) {
                    obj.selectNone()
                    next = obj.columns.length-1
                }
                if (next != null) {
                    if (shiftKey && key == 39 && obj.multiSelect) {
                        if (tmpUnselect()) return
                        let tmp    = []
                        let newSel = []
                        let unSel  = []
                        if (columns.indexOf(obj.last.sel_col) == columns.length-1 && columns.length > 1) {
                            for (let i = 0; i < sel.length; i++) {
                                if (tmp.indexOf(sel[i].recid) == -1) tmp.push(sel[i].recid)
                                unSel.push({ recid: sel[i].recid, column: columns[0] })
                            }
                            obj.unselect(unSel)
                            obj.scrollIntoView(ind, columns[0], true)
                        } else {
                            for (let i = 0; i < sel.length; i++) {
                                if (tmp.indexOf(sel[i].recid) == -1) tmp.push(sel[i].recid)
                                newSel.push({ recid: sel[i].recid, column: next })
                            }
                            obj.select(newSel)
                            obj.scrollIntoView(ind, next, true)
                        }
                    } else {
                        event.metaKey = false
                        obj.click({ recid: recid, column: next }, event)
                        obj.scrollIntoView(ind, next, true)
                    }
                } else {
                    // if selected more then one, then select first
                    if (!shiftKey) {
                        if (sel.length > 1) {
                            obj.selectNone()
                        } else {
                            for (let s = 0; s < sel.length-1; s++) obj.unselect(sel[s])
                        }
                    }
                }
            }
            cancel = true
        }
        function moveUp(numRows) {
            if (empty) selectTopRecord()
            if (recEL.length <= 0) return
            // move to the previous record
            let prev = obj.prevRow(ind, obj.selectType == 'row' ? 0 : sel[0].column, numRows)
            if (!shiftKey && prev == null) {
                if (obj.searchData.length != 0 && !url) {
                    prev = obj.last.searchIds[0]
                } else {
                    prev = 0
                }
            }
            if (prev != null) {
                if (shiftKey && obj.multiSelect) { // expand selection
                    if (tmpUnselect()) return
                    if (obj.selectType == 'row') {
                        if (obj.last.sel_ind > prev && obj.last.sel_ind != ind2) {
                            obj.unselect(obj.records[ind2].recid)
                        } else {
                            obj.select(obj.records[prev].recid)
                        }
                    } else {
                        if (obj.last.sel_ind > prev && obj.last.sel_ind != ind2) {
                            prev    = ind2
                            let tmp = []
                            for (let c = 0; c < columns.length; c++) tmp.push({ recid: obj.records[prev].recid, column: columns[c] })
                            obj.unselect(tmp)
                        } else {
                            let tmp = []
                            for (let c = 0; c < columns.length; c++) tmp.push({ recid: obj.records[prev].recid, column: columns[c] })
                            obj.select(tmp)
                        }
                    }
                } else { // move selected record
                    if (sel.length > 300) obj.selectNone(); else obj.unselect(sel)
                    obj.click({ recid: obj.records[prev].recid, column: columns[0] }, event)
                }
                obj.scrollIntoView(prev, null, false, numRows != 1) // top align record
                if (event.preventDefault) event.preventDefault()
            } else {
                // if selected more then one, then select first
                if (!shiftKey) {
                    if (sel.length > 1) {
                        obj.selectNone()
                    } else {
                        for (let s = 1; s < sel.length; s++) obj.unselect(sel[s])
                    }
                }
            }
        }
        function moveDown(numRows) {
            if (empty) selectTopRecord()
            if (recEL.length <= 0) return
            // move to the next record
            let next = obj.nextRow(ind2, obj.selectType == 'row' ? 0 : sel[0].column, numRows)
            if (!shiftKey && next == null) {
                if (obj.searchData.length != 0 && !url) {
                    next = obj.last.searchIds[obj.last.searchIds.length - 1]
                } else {
                    next = obj.records.length - 1
                }
            }
            if (next != null) {
                if (shiftKey && obj.multiSelect) { // expand selection
                    if (tmpUnselect()) return
                    if (obj.selectType == 'row') {
                        if (obj.last.sel_ind < next && obj.last.sel_ind != ind) {
                            obj.unselect(obj.records[ind].recid)
                        } else {
                            obj.select(obj.records[next].recid)
                        }
                    } else {
                        if (obj.last.sel_ind < next && obj.last.sel_ind != ind) {
                            next    = ind
                            let tmp = []
                            for (let c = 0; c < columns.length; c++) tmp.push({ recid: obj.records[next].recid, column: columns[c] })
                            obj.unselect(tmp)
                        } else {
                            let tmp = []
                            for (let c = 0; c < columns.length; c++) tmp.push({ recid: obj.records[next].recid, column: columns[c] })
                            obj.select(tmp)
                        }
                    }
                } else { // move selected record
                    if (sel.length > 300) obj.selectNone(); else obj.unselect(sel)
                    obj.click({ recid: obj.records[next].recid, column: columns[0] }, event)
                }
                obj.scrollIntoView(next, null, false, numRows != 1) // top align record
                cancel = true
            } else {
                // if selected more then one, then select first
                if (!shiftKey) {
                    if (sel.length > 1) {
                        obj.selectNone()
                    } else {
                        for (let s = 0; s < sel.length-1; s++) obj.unselect(sel[s])
                    }
                }
            }
        }
        function selectTopRecord() {
            if (!obj.records || obj.records.length === 0) return
            let ind = Math.floor(records[0].scrollTop / obj.recordHeight) + 1
            if (!obj.records[ind] || ind < 2) ind = 0
            if (typeof obj.records[ind] === 'undefined') return
            obj.select({ recid: obj.records[ind].recid, column: 0})
        }
        function tmpUnselect () {
            if (obj.last.sel_type != 'click') return false
            if (obj.selectType != 'row') {
                obj.last.sel_type = 'key'
                if (sel.length > 1) {
                    for (let s = 0; s < sel.length; s++) {
                        if (sel[s].recid == obj.last.sel_recid && sel[s].column == obj.last.sel_col) {
                            sel.splice(s, 1)
                            break
                        }
                    }
                    obj.unselect(sel)
                    return true
                }
                return false
            } else {
                obj.last.sel_type = 'key'
                if (sel.length > 1) {
                    sel.splice(sel.indexOf(obj.records[obj.last.sel_ind].recid), 1)
                    obj.unselect(sel)
                    return true
                }
                return false
            }
        }
    }
    scrollIntoView(ind, column, instant, recTop) {
        let buffered = this.records.length
        if (this.searchData.length != 0 && !this.url) buffered = this.last.searchIds.length
        if (buffered === 0) return
        if (ind == null) {
            let sel = this.getSelection()
            if (sel.length === 0) return
            if ($.isPlainObject(sel[0])) {
                ind    = sel[0].index
                column = sel[0].column
            } else {
                ind = this.get(sel[0], true)
            }
        }
        let records = $(this.box).find('#grid_'+ this.name +'_records')
        // if all records in view
        let len = this.last.searchIds.length
        if (len > 0) ind = this.last.searchIds.indexOf(ind) // if search is applied
        // vertical
        if (records.height() < this.recordHeight * (len > 0 ? len : buffered) && records.length > 0) {
            // scroll to correct one
            let t1 = Math.floor(records[0].scrollTop / this.recordHeight)
            let t2 = t1 + Math.floor(records.height() / this.recordHeight)
            if (ind == t1) {
                if (instant === true) {
                    records.prop({ 'scrollTop': records.scrollTop() - records.height() / 1.3 })
                } else {
                    records.stop()
                    records.animate({ 'scrollTop': records.scrollTop() - records.height() / 1.3 }, 250, 'linear')
                }
            }
            if (ind == t2) {
                if (instant === true) {
                    records.prop({ 'scrollTop': records.scrollTop() + records.height() / 1.3 })
                } else {
                    records.stop()
                    records.animate({ 'scrollTop': records.scrollTop() + records.height() / 1.3 }, 250, 'linear')
                }
            }
            if (ind < t1 || ind > t2) {
                if (instant === true) {
                    records.prop({ 'scrollTop': (ind - 1) * this.recordHeight })
                } else {
                    records.stop()
                    records.animate({ 'scrollTop': (ind - 1) * this.recordHeight }, 250, 'linear')
                }
            }
            if (recTop === true) {
                if (instant === true) {
                    records.prop({ 'scrollTop': ind * this.recordHeight })
                } else {
                    records.stop()
                    records.animate({ 'scrollTop': ind * this.recordHeight }, 250, 'linear')
                }
            }
        }
        // horizontal
        if (column != null) {
            let x1 = 0
            let x2 = 0
            let sb = w2utils.scrollBarSize()
            for (let i = 0; i <= column; i++) {
                let col = this.columns[i]
                if (col.frozen || col.hidden) continue
                x1  = x2
                x2 += parseInt(col.sizeCalculated)
            }
            if (records.width() < x2 - records.scrollLeft()) { // right
                if (instant === true) {
                    records.prop({ 'scrollLeft': x1 - sb })
                } else {
                    records.animate({ 'scrollLeft': x1 - sb }, 250, 'linear')
                }
            } else if (x1 < records.scrollLeft()) { // left
                if (instant === true) {
                    records.prop({ 'scrollLeft': x2 - records.width() + sb * 2 })
                } else {
                    records.animate({ 'scrollLeft': x2 - records.width() + sb * 2 }, 250, 'linear')
                }
            }
        }
    }
    scrollToColumn(field) {
        if (field == null)
            return
        let sWidth = 0
        let found  = false
        for (let i = 0; i < this.columns.length; i++) {
            let col = this.columns[i]
            if (col.field == field) {
                found = true
                break
            }
            if (col.frozen || col.hidden)
                continue
            let cSize = parseInt(col.sizeCalculated ? col.sizeCalculated : col.size)
            sWidth   += cSize
        }
        if (!found)
            return
        this.last.scrollLeft = sWidth+1
        this.scroll()
    }

    dblClick(recid, event) {
        // find columns
        let column = null
        if ((typeof recid == 'object') && (recid !== null)) {
            column = recid.column
            recid  = recid.recid
        }
        if (event == null) event = {}
        // column user clicked on
        if (column == null && event.target) {
            let tmp = event.target
            if (tmp.tagName.toUpperCase() != 'TD') tmp = $(tmp).parents('td')[0]
            column = parseInt($(tmp).attr('col'))
        }
        let index = this.get(recid, true)
        let rec   = this.records[index]
        // event before
        let edata = this.trigger({ phase: 'before', target: this.name, type: 'dblClick', recid: recid, column: column, originalEvent: event })
        if (edata.isCancelled === true) return
        // default action
        this.selectNone()
        let edit = this.getCellEditable(index, column)
        if (edit) {
            this.editField(recid, column, null, event)
        } else {
            this.select({ recid: recid, column: column })
            if (this.show.expandColumn || (rec && rec.w2ui && Array.isArray(rec.w2ui.children))) this.toggle(recid)
        }
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
    }
    contextMenu(recid, column, event) {
        if (this.last.userSelect == 'text') return
        if (event == null) {
            event = { offsetX: 0, offsetY: 0, target: query(this.box).find(`#grid_${this.name}_rec_${recid}`)[0] }
        }
        if (event.offsetX == null) {
            event.offsetX = event.layerX - event.target.offsetLeft
            event.offsetY = event.layerY - event.target.offsetTop
        }
        if (w2utils.isFloat(recid)) recid = parseFloat(recid)
        let sel = this.getSelection()
        if (this.selectType == 'row') {
            if (sel.indexOf(recid) == -1) this.click(recid)
        } else {
            let $tmp = query(event.target)
            if ($tmp[0].tagName.toUpperCase() != 'TD') $tmp = query(event.target).closest('td')
            let selected = false
            column = $tmp.attr('col')
            // check if any selected sel in the right row/column
            for (let i = 0; i<sel.length; i++) {
                if (sel[i].recid == recid || sel[i].column == column) selected = true
            }
            if (!selected && recid != null) this.click({ recid: recid, column: column })
            if (!selected && column != null) this.columnClick(this.columns[column].field, event)
        }
        // event before
        let edata = this.trigger('contextMenu', { target: this.name, originalEvent: event, recid, column })
        if (edata.isCancelled === true) return
        // default action
        if (this.menu.length > 0) {
            w2menu.show({
                name: this.name + '-context-menu',
                anchor: document.body,
                originalEvent: event.originalEvent,
                items: this.menu
            })
            .select((event) => {
                this.menuClick(recid, event)
            })
        }
        // cancel event
        if (event.preventDefault) event.preventDefault()
        // event after
        edata.finish()
    }
    menuClick(recid, event) {
        // event before
        let edata = this.trigger('menuClick', { target: this.name, recid, originalEvent: event.detail.originalEvent,
            menuEvent: event, menuIndex: event.detail.index, menuItem: event.detail.item
        })
        if (edata.isCancelled === true) return
        // default action
        // -- empty
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
    }
    toggle(recid) {
        let rec  = this.get(recid)
        if (rec == null) return
        rec.w2ui = rec.w2ui || {}
        if (rec.w2ui.expanded === true) return this.collapse(recid); else return this.expand(recid)
    }
    expand(recid, noRefresh) {
        let ind      = this.get(recid, true)
        let rec      = this.records[ind]
        rec.w2ui     = rec.w2ui || {}
        let id       = w2utils.escapeId(recid)
        let children = rec.w2ui.children
        let edata
        if (Array.isArray(children)) {
            if (rec.w2ui.expanded === true || children.length === 0) return false // already shown
            edata = this.trigger({ phase: 'before', type: 'expand', target: this.name, recid: recid })
            if (edata.isCancelled === true) return false
            rec.w2ui.expanded = true
            children.forEach((child) => {
                child.w2ui              = child.w2ui || {}
                child.w2ui.parent_recid = rec.recid
                if (child.w2ui.children == null) child.w2ui.children = []
            })
            this.records.splice.apply(this.records, [ind + 1, 0].concat(children))
            if (this.total !== -1) {
                this.total += children.length
            }
            let url     = (typeof this.url != 'object' ? this.url : this.url.get)
            if (!url) {
                this.localSort(true, true)
                if (this.searchData.length > 0) {
                    this.localSearch(true)
                }
            }
            if (noRefresh !== true) this.refresh()
            this.trigger($.extend(edata, { phase: 'after' }))
        } else {
            if ($(this.box).find('#grid_'+ this.name +'_rec_'+ id +'_expanded_row').length > 0 || this.show.expandColumn !== true) return false
            if (rec.w2ui.expanded == 'none') return false
            // insert expand row
            $(this.box).find('#grid_'+ this.name +'_rec_'+ id).after(
                '<tr id="grid_'+ this.name +'_rec_'+ recid +'_expanded_row" class="w2ui-expanded-row">'+
                    '    <td colspan="100" class="w2ui-expanded2">'+
                    '        <div id="grid_'+ this.name +'_rec_'+ recid +'_expanded"></div>'+
                    '    </td>'+
                    '    <td class="w2ui-grid-data-last"></td>'+
                    '</tr>')
            $(this.box).find('#grid_'+ this.name +'_frec_'+ id).after(
                '<tr id="grid_'+ this.name +'_frec_'+ recid +'_expanded_row" class="w2ui-expanded-row">'+
                        (this.show.lineNumbers ? '<td class="w2ui-col-number"></td>' : '') +
                    '    <td class="w2ui-grid-data w2ui-expanded1" colspan="100">'+
                    '       <div id="grid_'+ this.name +'_frec_'+ recid +'_expanded"></div>'+
                    '   </td>'+
                    '</tr>')
            // event before
            edata = this.trigger({ phase: 'before', type: 'expand', target: this.name, recid: recid,
                box_id: 'grid_'+ this.name +'_rec_'+ recid +'_expanded', fbox_id: 'grid_'+ this.name +'_frec_'+ id +'_expanded' })
            if (edata.isCancelled === true) {
                $(this.box).find('#grid_'+ this.name +'_rec_'+ id +'_expanded_row').remove()
                $(this.box).find('#grid_'+ this.name +'_frec_'+ id +'_expanded_row').remove()
                return false
            }
            // expand column
            let row1        = $(this.box).find('#grid_'+ this.name +'_rec_'+ recid +'_expanded')
            let row2        = $(this.box).find('#grid_'+ this.name +'_frec_'+ recid +'_expanded')
            let innerHeight = row1.find('> div:first-child').height()
            if (row1.height() < innerHeight) {
                row1.css({ height: innerHeight + 'px' })
            }
            if (row2.height() < innerHeight) {
                row2.css({ height: innerHeight + 'px' })
            }
            // default action
            $(this.box).find('#grid_'+ this.name +'_rec_'+ id).attr('expanded', 'yes').addClass('w2ui-expanded')
            $(this.box).find('#grid_'+ this.name +'_frec_'+ id).attr('expanded', 'yes').addClass('w2ui-expanded')
            // $(this.box).find('#grid_'+ this.name +'_rec_'+ id +'_expanded_row').show();
            $(this.box).find('#grid_'+ this.name +'_cell_'+ this.get(recid, true) +'_expand div').html('-')
            rec.w2ui.expanded = true
            // event after
            this.trigger($.extend(edata, { phase: 'after' }))
            this.resizeRecords()
        }
        return true
    }
    collapse(recid, noRefresh) {
        let ind      = this.get(recid, true)
        let rec      = this.records[ind]
        rec.w2ui     = rec.w2ui || {}
        let id       = w2utils.escapeId(recid)
        let children = rec.w2ui.children
        let edata
        if (Array.isArray(children)) {
            if (rec.w2ui.expanded !== true) return false // already hidden
            edata = this.trigger({ phase: 'before', type: 'collapse', target: this.name, recid: recid })
            if (edata.isCancelled === true) return false
            clearExpanded(rec)
            let stops = []
            for (let r = rec; r != null; r = this.get(r.w2ui.parent_recid))
                stops.push(r.w2ui.parent_recid)
            // stops contains 'undefined' plus the ID of all nodes in the path from 'rec' to the tree root
            let start = ind + 1
            let end   = start
            while (true) {
                if (this.records.length <= end + 1 || this.records[end+1].w2ui == null ||
                    stops.indexOf(this.records[end+1].w2ui.parent_recid) >= 0) {
                    break
                }
                end++
            }
            this.records.splice(start, end - start + 1)
            if (this.total !== -1) {
                this.total -= end - start + 1
            }
            let url     = (typeof this.url != 'object' ? this.url : this.url.get)
            if (!url) {
                if (this.searchData.length > 0) {
                    this.localSearch(true)
                }
            }
            if (noRefresh !== true) this.refresh()
            this.trigger($.extend(edata, { phase: 'after' }))
        } else {
            if ($(this.box).find('#grid_'+ this.name +'_rec_'+ id +'_expanded_row').length === 0 || this.show.expandColumn !== true) return false
            // event before
            edata = this.trigger({ phase: 'before', type: 'collapse', target: this.name, recid: recid,
                box_id: 'grid_'+ this.name +'_rec_'+ id +'_expanded', fbox_id: 'grid_'+ this.name +'_frec_'+ id +'_expanded' })
            if (edata.isCancelled === true) return false
            // default action
            $(this.box).find('#grid_'+ this.name +'_rec_'+ id).removeAttr('expanded').removeClass('w2ui-expanded')
            $(this.box).find('#grid_'+ this.name +'_frec_'+ id).removeAttr('expanded').removeClass('w2ui-expanded')
            $(this.box).find('#grid_'+ this.name +'_cell_'+ this.get(recid, true) +'_expand div').html('+')
            $(this.box).find('#grid_'+ this.name +'_rec_'+ id +'_expanded').css('height', '0px')
            $(this.box).find('#grid_'+ this.name +'_frec_'+ id +'_expanded').css('height', '0px')
            setTimeout(() => {
                $(this.box).find('#grid_'+ this.name +'_rec_'+ id +'_expanded_row').remove()
                $(this.box).find('#grid_'+ this.name +'_frec_'+ id +'_expanded_row').remove()
                rec.w2ui.expanded = false
                // event after
                this.trigger($.extend(edata, { phase: 'after' }))
                this.resizeRecords()
            }, 300)
        }
        return true
        function clearExpanded(rec) {
            rec.w2ui.expanded = false
            for (let i = 0; i < rec.w2ui.children.length; i++) {
                let subRec = rec.w2ui.children[i]
                if (subRec.w2ui.expanded) {
                    clearExpanded(subRec)
                }
            }
        }
    }
    sort(field, direction, multiField) { // if no params - clears sort
        // event before
        let edata = this.trigger({ phase: 'before', type: 'sort', target: this.name, field: field, direction: direction, multiField: multiField })
        if (edata.isCancelled === true) return
        // check if needed to quit
        if (field != null) {
            // default action
            let sortIndex = this.sortData.length
            for (let s = 0; s < this.sortData.length; s++) {
                if (this.sortData[s].field == field) { sortIndex = s; break }
            }
            if (direction == null) {
                if (this.sortData[sortIndex] == null) {
                    direction = 'asc'
                } else {
                    if (this.sortData[sortIndex].direction == null) {
                        this.sortData[sortIndex].direction = ''
                    }
                    switch (this.sortData[sortIndex].direction.toLowerCase()) {
                        case 'asc' : direction = 'desc'; break
                        case 'desc' : direction = 'asc'; break
                        default : direction = 'asc'; break
                    }
                }
            }
            if (this.multiSort === false) { this.sortData = []; sortIndex = 0 }
            if (multiField != true) { this.sortData = []; sortIndex = 0 }
            // set new sort
            if (this.sortData[sortIndex] == null) this.sortData[sortIndex] = {}
            this.sortData[sortIndex].field     = field
            this.sortData[sortIndex].direction = direction
        } else {
            this.sortData = []
        }
        // if local
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if (!url) {
            this.localSort(false, true)
            if (this.searchData.length > 0) this.localSearch(true)
            // reset vertical scroll
            this.last.scrollTop = 0
            $(this.box).find('#grid_'+ this.name +'_records').prop('scrollTop', 0)
            // event after
            this.trigger($.extend(edata, { phase: 'after', direction: direction }))
            this.refresh()
        } else {
            // event after
            this.trigger($.extend(edata, { phase: 'after', direction: direction }))
            this.last.xhr_offset = 0
            this.reload()
        }
    }
    copy(flag, oEvent) {
        if ($.isPlainObject(flag)) {
            // event after
            this.trigger($.extend(flag, { phase: 'after' }))
            return flag.text
        }
        // generate text to copy
        let sel = this.getSelection()
        if (sel.length === 0) return ''
        let text = ''
        if (typeof sel[0] == 'object') { // cell copy
            // find min/max column
            let minCol = sel[0].column
            let maxCol = sel[0].column
            let recs   = []
            for (let s = 0; s < sel.length; s++) {
                if (sel[s].column < minCol) minCol = sel[s].column
                if (sel[s].column > maxCol) maxCol = sel[s].column
                if (recs.indexOf(sel[s].index) == -1) recs.push(sel[s].index)
            }
            recs.sort((a, b) => { return a-b }) // sort function must be for numerical sort
            for (let r = 0 ; r < recs.length; r++) {
                let ind = recs[r]
                for (let c = minCol; c <= maxCol; c++) {
                    let col = this.columns[c]
                    if (col.hidden === true) continue
                    text += this.getCellCopy(ind, c) + '\t'
                }
                text  = text.substr(0, text.length-1) // remove last \t
                text += '\n'
            }
        } else { // row copy
            // copy headers
            for (let c = 0; c < this.columns.length; c++) {
                let col = this.columns[c]
                if (col.hidden === true) continue
                let colName = (col.text ? col.text : col.field)
                if (col.text && col.text.length < 3 && col.tooltip) colName = col.tooltip // if column name is less then 3 char and there is tooltip - use it
                text += '"' + w2utils.stripTags(colName) + '"\t'
            }
            text  = text.substr(0, text.length-1) // remove last \t
            text += '\n'
            // copy selected text
            for (let s = 0; s < sel.length; s++) {
                let ind = this.get(sel[s], true)
                for (let c = 0; c < this.columns.length; c++) {
                    let col = this.columns[c]
                    if (col.hidden === true) continue
                    text += '"' + this.getCellCopy(ind, c) + '"\t'
                }
                text  = text.substr(0, text.length-1) // remove last \t
                text += '\n'
            }
        }
        text = text.substr(0, text.length - 1)
        // if called without params
        let edata
        if (flag == null) {
            // before event
            edata = this.trigger({ phase: 'before', type: 'copy', target: this.name, text: text,
                cut: (oEvent.keyCode == 88 ? true : false), originalEvent: oEvent })
            if (edata.isCancelled === true) return ''
            text = edata.detail.text
            // event after
            this.trigger($.extend(edata, { phase: 'after' }))
            return text
        } else if (flag === false) { // only before event
            // before event
            edata = this.trigger({ phase: 'before', type: 'copy', target: this.name, text: text,
                cut: (oEvent.keyCode == 88 ? true : false), originalEvent: oEvent })
            if (edata.isCancelled === true) return ''
            text = edata.detail.text
            return edata
        }
    }
    /**
     * Gets value to be copied to the clipboard
     * @param ind index of the record
     * @param col_ind index of the column
     * @returns the displayed value of the field's record associated with the cell
     */
    getCellCopy(ind, col_ind) {
        return w2utils.stripTags(this.getCellHTML(ind, col_ind))
    }
    paste(text, event) {
        let sel = this.getSelection()
        let ind = this.get(sel[0].recid, true)
        let col = sel[0].column
        // before event
        let edata = this.trigger({ phase: 'before', type: 'paste', target: this.name, text: text,
            index: ind, column: col, originalEvent: event })
        if (edata.isCancelled === true) return
        text = edata.detail.text
        // default action
        if (this.selectType == 'row' || sel.length === 0) {
            console.log('ERROR: You can paste only if grid.selectType = \'cell\' and when at least one cell selected.')
            // event after
            this.trigger($.extend(edata, { phase: 'after' }))
            return
        }
        if (typeof text !== 'object') {
            let newSel = []
            text = text.split('\n')
            for (let t = 0; t < text.length; t++) {
                let tmp  = text[t].split('\t')
                let cnt  = 0
                let rec  = this.records[ind]
                let cols = []
                if (rec == null) continue
                for (let dt = 0; dt < tmp.length; dt++) {
                    if (!this.columns[col + cnt]) continue
                    setCellPaste(rec, this.columns[col + cnt].field, tmp[dt])
                    cols.push(col + cnt)
                    cnt++
                }
                for (let c = 0; c < cols.length; c++) newSel.push({ recid: rec.recid, column: cols[c] })
                ind++
            }
            this.selectNone();
            this.select(newSel);
        } else {
            this.selectNone();
            this.select([{ recid: this.records[ind], column: col }]);
        }
        this.refresh()
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
        function setCellPaste(rec, field, paste) {
            rec.w2ui = rec.w2ui || {}
            rec.w2ui.changes = rec.w2ui.changes || {}
            rec.w2ui.changes[field] = paste
        }
    }
    // ==================================================
    // --- Common functions
    resize() {
        let time = (new Date()).getTime()
        // make sure the box is right
        if (!this.box || $(this.box).attr('name') != this.name) return
        // determine new width and height
        $(this.box).find('> div.w2ui-grid-box')
            .css('width', $(this.box).width())
            .css('height', $(this.box).height())
        // event before
        let edata = this.trigger({ phase: 'before', type: 'resize', target: this.name })
        if (edata.isCancelled === true) return
        // resize
        this.resizeBoxes()
        this.resizeRecords()
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
        return (new Date()).getTime() - time
    }
    update({ cells, fullCellRefresh, ignoreColumns } = {}) {
        let time = (new Date()).getTime()
        let self = this
        if (this.box == null) return 0
        if (Array.isArray(cells)) {
            for (let i = 0; i < cells.length; i++) {
                let index  = cells[i].index
                let column = cells[i].column
                if (index < 0) continue
                if (index == null || column == null) {
                    console.log('ERROR: Wrong argument for grid.update({ cells }), cells should be [{ index: X, column: Y }, ...]')
                    continue
                }
                let rec  = this.records[index] ?? {}
                rec.w2ui = rec.w2ui ?? {}
                rec.w2ui._update = rec.w2ui._update ?? { cells: [] }
                let row1 = rec.w2ui._update.row1
                let row2 = rec.w2ui._update.row2
                if (row1 == null || !row1.isConnected || row2 == null || !row2.isColSelected) {
                    row1 = this.box.querySelector(`#grid_${this.name}_rec_${w2utils.escapeId(rec.recid)}`)
                    row2 = this.box.querySelector(`#grid_${this.name}_frec_${w2utils.escapeId(rec.recid)}`)
                    rec.w2ui._update.row1 = row1
                    rec.w2ui._update.row2 = row2
                }
                _update(rec, row1, row2, index, column)
            }
        } else {
            for (let i = this.last.range_start-1; i <= this.last.range_end; i++) {
                let index = i
                if (this.last.searchIds.length > 0) { // if search is applied
                    index = this.last.searchIds[i]
                } else {
                    index = i
                }
                let rec = this.records[index]
                if (index < 0 || rec == null) continue
                rec.w2ui = rec.w2ui ?? {}
                rec.w2ui._update = rec.w2ui._update ?? { cells: [] }
                let row1 = rec.w2ui._update.row1
                let row2 = rec.w2ui._update.row2
                if (row1 == null || !row1.isConnected || row2 == null || !row2.isColSelected) {
                    row1 = this.box.querySelector(`#grid_${this.name}_rec_${w2utils.escapeId(rec.recid)}`)
                    row2 = this.box.querySelector(`#grid_${this.name}_frec_${w2utils.escapeId(rec.recid)}`)
                    rec.w2ui._update.row1 = row1
                    rec.w2ui._update.row2 = row2
                }
                for (let column = 0; column < this.columns.length; column++) {
                    _update(rec, row1, row2, index, column)
                }
            }
        }
        return (new Date()).getTime() - time
        function _update(rec, row1, row2, index, column) {
            let pcol = self.columns[column]
            if (Array.isArray(ignoreColumns) && (ignoreColumns.includes(column) || ignoreColumns.includes(pcol.field))) {
                return
            }
            let cell = rec.w2ui._update.cells[column]
            if (cell == null || !cell.isConnected) {
                cell = self.box.querySelector(`#grid_${self.name}_data_${index}_${column}`)
                rec.w2ui._update.cells[column] = cell
            }
            if (cell == null) return
            if (fullCellRefresh) {
                $(cell).replaceWith(self.getCellHTML(index, column, false))
                // need to reselect as it was replaced
                cell = self.box.querySelector(`#grid_${self.name}_data_${index}_${column}`)
                rec.w2ui._update.cells[column] = cell
            } else {
                let div = cell.children[0] // there is always a div inside a cell
                // value, attr, style, className, divAttr -- all on TD level except divAttr
                let { value, style, className, attr, divAtt } = self.getCellValue(index, column, false, true)
                if (div.innerHTML != value) {
                    div.innerHTML = value
                }
                if (style != '' && cell.style.cssText != style) {
                    cell.style.cssText = style
                }
                if (className != '') {
                    let ignore = ['w2ui-grid-data']
                    let remove = []
                    let add = className.split(' ').filter(cl => !!cl) // remove empty
                    cell.classList.forEach(cl => { if (!ignore.includes(cl)) remove.push(cl)})
                    cell.classList.remove(...remove)
                    cell.classList.add(...add)
                }
            }
            // column styles if any (lower priority)
            if (self.columns[column].style && self.columns[column].style != cell.style.cssText) {
                cell.style.cssText = self.columns[column].style ?? ''
            }
            // record class if any
            if (rec.w2ui.class != null) {
                if (typeof rec.w2ui.class == 'string') {
                    let ignore = ['w2ui-odd', 'w2ui-even', 'w2ui-record']
                    let remove = []
                    let add = rec.w2ui.class.split(' ').filter(cl => !!cl) // remove empty
                    if (row1 && row2) {
                        row1.classList.forEach(cl => { if (!ignore.includes(cl)) remove.push(cl)})
                        row1.classList.remove(...remove)
                        row1.classList.add(...add)
                        row2.classList.remove(...remove)
                        row2.classList.add(...add)
                    }
                }
                if ($.isPlainObject(rec.w2ui.class) && typeof rec.w2ui.class[pcol.field] == 'string') {
                    let ignore = ['w2ui-grid-data']
                    let remove = []
                    let add = rec.w2ui.class[pcol.field].split(' ').filter(cl => !!cl)
                    cell.classList.forEach(cl => { if (!ignore.includes(cl)) remove.push(cl)})
                    cell.classList.remove(...remove)
                    cell.classList.add(...add)
                }
            }
            // record styles if any
            if (rec.w2ui.style != null) {
                if (row1 && row2 && typeof rec.w2ui.style == 'string' && row1.style.cssText !== rec.w2ui.style) {
                    row1.style.cssText = 'height: '+ self.recordHeight + 'px;' + rec.w2ui.style
                    row1.setAttribute('custom_style', rec.w2ui.style)
                    row2.style.cssText = 'height: '+ self.recordHeight + 'px;' + rec.w2ui.style
                    row2.setAttribute('custom_style', rec.w2ui.style)
                }
                if ($.isPlainObject(rec.w2ui.style) && typeof rec.w2ui.style[pcol.field] == 'string'
                        && cell.style.cssText !== rec.w2ui.style[pcol.field]) {
                    cell.style.cssText = rec.w2ui.style[pcol.field]
                }
            }
        }
    }
    refreshCell(recid, field) {
        let index     = this.get(recid, true)
        let col_ind   = this.getColumn(field, true)
        let isSummary = (this.records[index] && this.records[index].recid == recid ? false : true)
        let cell      = $(this.box).find((isSummary ? '.w2ui-grid-summary ' : '') + '#grid_'+ this.name + '_data_'+ index +'_'+ col_ind)
        if (cell.length == 0) return false
        // set cell html and changed flag
        cell.replaceWith(this.getCellHTML(index, col_ind, isSummary))
    }
    refreshRow(recid, ind) {
        let tr1 = $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid))
        let tr2 = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid))
        if (tr1.length > 0) {
            if (ind == null) ind = this.get(recid, true)
            let line      = tr1.attr('line')
            let isSummary = (this.records[ind] && this.records[ind].recid == recid ? false : true)
            // if it is searched, find index in search array
            let url = (typeof this.url != 'object' ? this.url : this.url.get)
            if (this.searchData.length > 0 && !url) for (let s = 0; s < this.last.searchIds.length; s++) if (this.last.searchIds[s] == ind) ind = s
            let rec_html = this.getRecordHTML(ind, line, isSummary)
            $(tr1).replaceWith(rec_html[0])
            $(tr2).replaceWith(rec_html[1])
            // apply style to row if it was changed in render functions
            let st = (this.records[ind].w2ui ? this.records[ind].w2ui.style : '')
            if (typeof st == 'string') {
                tr1 = $(this.box).find('#grid_'+ this.name +'_frec_'+ w2utils.escapeId(recid))
                tr2 = $(this.box).find('#grid_'+ this.name +'_rec_'+ w2utils.escapeId(recid))
                tr1.attr('custom_style', st)
                tr2.attr('custom_style', st)
                if (tr1.hasClass('w2ui-selected')) {
                    st = st.replace('background-color', 'none')
                }
                tr1[0].style.cssText = 'height: '+ this.recordHeight + 'px;' + st
                tr2[0].style.cssText = 'height: '+ this.recordHeight + 'px;' + st
            }
            if (isSummary) {
                this.resize()
            }
        }
    }
    refresh() {
        let time = (new Date()).getTime()
        let url  = (typeof this.url != 'object' ? this.url : this.url.get)
        if (this.total <= 0 && !url && this.searchData.length === 0) {
            this.total = this.records.length
        }
        if (!this.box) return
        // event before
        let edata = this.trigger({ phase: 'before', target: this.name, type: 'refresh' })
        if (edata.isCancelled === true) return
        // -- header
        if (this.show.header) {
            $(this.box).find('#grid_'+ this.name +'_header').html(w2utils.lang(this.header) +'&#160;').show()
        } else {
            $(this.box).find('#grid_'+ this.name +'_header').hide()
        }
        // -- toolbar
        if (this.show.toolbar) {
            $(this.box).find('#grid_'+ this.name +'_toolbar').show()
        } else {
            $(this.box).find('#grid_'+ this.name +'_toolbar').hide()
        }
        // -- make sure search is closed
        this.searchClose()
        // search placeholder
        let el = $(this.box).find('#grid_'+ this.name +'_search_all')
        if (!this.multiSearch && this.last.field == 'all' && this.searches.length > 0) {
            this.last.field = this.searches[0].field
            this.last.label = this.searches[0].label
        }
        for (let s = 0; s < this.searches.length; s++) {
            if (this.searches[s].field == this.last.field) this.last.label = this.searches[s].label
        }
        if (this.last.multi) {
            el.attr('placeholder', '[' + w2utils.lang('Multiple Fields') + ']')
            if ($.fn.w2field) el.w2field('clear')
        } else {
            el.attr('placeholder', w2utils.lang('Search') + ' ' + w2utils.lang(this.last.label, true))
        }
        if (el.val() != this.last.search) {
            let val = this.last.search
            let tmp = el.data('w2field')
            if (tmp) val = tmp.format(val)
            el.val(val)
        }
        this.refreshSearch()
        this.refreshBody()
        // -- footer
        if (this.show.footer) {
            $(this.box).find('#grid_'+ this.name +'_footer').html(this.getFooterHTML()).show()
        } else {
            $(this.box).find('#grid_'+ this.name +'_footer').hide()
        }
        // all selected?
        let sel = this.last.selection,
            areAllSelected = (this.records.length > 0 && sel.indexes.length == this.records.length),
            areAllSearchedSelected = (sel.indexes.length > 0 && this.searchData.length !== 0 && sel.indexes.length == this.last.searchIds.length)
        if (areAllSelected || areAllSearchedSelected) {
            $(this.box).find('#grid_'+ this.name +'_check_all').prop('checked', true)
        } else {
            $(this.box).find('#grid_'+ this.name +'_check_all').prop('checked', false)
        }
        // show number of selected
        this.status()
        // collapse all records
        let rows = this.find({ 'w2ui.expanded': true }, true, true)
        for (let r = 0; r < rows.length; r++) {
            let tmp = this.records[rows[r]].w2ui
            if (tmp && !Array.isArray(tmp.children)) {
                tmp.expanded = false
            }
        }
        // mark selection
        if (this.markSearch) {
            setTimeout(() => {
                // mark all search strings
                let search = []
                for (let s = 0; s < this.searchData.length; s++) {
                    let sdata = this.searchData[s]
                    let fld   = this.getSearch(sdata.field)
                    if (!fld || fld.hidden) continue
                    let ind = this.getColumn(sdata.field, true)
                    search.push({ field: sdata.field, search: sdata.value, col: ind })
                }
                if (search.length > 0) {
                    search.forEach((item) => {
                        $(this.box).find('td[col="'+ item.col +'"]').not('.w2ui-head').w2marker(item.search)
                    })
                }
            }, 50)
        }
        this.updateToolbar()
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
        this.resize()
        this.addRange('selection')
        setTimeout(() => { // allow to render first
            this.resize() // needed for horizontal scroll to show (do not remove)
            this.scroll()
        }, 1)
        if (this.reorderColumns && !this.last.columnDrag) {
            this.last.columnDrag = this.initColumnDrag()
        } else if (!this.reorderColumns && this.last.columnDrag) {
            this.last.columnDrag.remove()
        }
        return (new Date()).getTime() - time
    }
    refreshSearch() {
        if (this.multiSearch && this.searchData.length > 0) {
            if ($(this.box).find('.w2ui-grid-searches').length == 0) {
                $(this.box).find('.w2ui-grid-toolbar')
                    .css('height', (this.last._toolbar_height + 35) + 'px')
                    .append(`<div id="grid_${this.name}_searches" class="w2ui-grid-searches"></div>`)
            }
            let searches = `
                <span id="grid_${this.name}_search_logic" class="w2ui-grid-search-logic"></span>
                <div class="grid-search-line"></div>`
            this.searchData.forEach((sd, sd_ind) => {
                let ind = this.getSearch(sd.field, true)
                let sf = this.searches[ind]
                let display
                if (Array.isArray(sd.value)) {
                    display = `<span class="grid-search-count">${sd.value.length}</span>`
                } else {
                    display = `: ${sd.value}`
                }
                if (sf && sf.type == 'date') {
                    if (sd.operator == 'between') {
                        let dsp1 = sd.value[0]
                        let dsp2 = sd.value[1]
                        if (Number(dsp1) === dsp1) {
                            dsp1 = w2utils.formatDate(dsp1)
                        }
                        if (Number(dsp2) === dsp2) {
                            dsp2 = w2utils.formatDate(dsp2)
                        }
                        display = `: ${dsp1} - ${dsp2}`
                    } else {
                        let dsp = sd.value
                        if (Number(dsp) == dsp) {
                            dsp = w2utils.formatDate(dsp)
                        }
                        let oper = sd.operator
                        if (oper == 'more') oper = 'since'
                        if (oper == 'less') oper = 'before'
                        if (oper.substr(0, 5) == 'more:') {
                            oper = 'since'
                        }
                        display = `: ${oper} ${dsp}`
                    }
                }
                searches += `<span class="w2ui-action" data-click="searchFieldDrop|${ind}|${sd_ind}|this">
                    ${sf ? sf.label : ''}
                    ${display}
                    <span class="icon-chevron-down"></span>
                </span>`
            })
            // clear and save
            searches += `
                ${this.show.searchSave
                    ? `<div class="grid-search-line"></div>
                       <button class="w2ui-btn grid-search-btn" data-click="searchSave">${w2utils.lang('Save')}</button>
                      `
                    : ''
                }
                <button class="w2ui-btn grid-search-btn btn-remove"
                    data-click="searchReset">X</button>
            `
            $(this.box).find(`#grid_${this.name}_searches`).html(searches)
            $(this.box).find(`#grid_${this.name}_search_logic`).html(w2utils.lang(this.last.logic == 'AND' ? 'All' : 'Any'))
        } else {
            $(this.box).find('.w2ui-grid-toolbar')
                .css('height', this.last._toolbar_height)
                .find('.w2ui-grid-searches')
                .remove()
        }
        if (this.searchSelected) {
            $(this.box).find(`#grid_${this.name}_search_all`).val(' ').prop('readOnly', true)
            $(this.box).find(`#grid_${this.name}_search_name`).show().find('.name-text').html(this.searchSelected.name)
        } else {
            $(this.box).find(`#grid_${this.name}_search_all`).prop('readOnly', false)
            $(this.box).find(`#grid_${this.name}_search_name`).hide().find('.name-text').html('')
        }
        w2utils.bindEvents($(this.box).find(`#grid_${this.name}_searches .w2ui-action, #grid_${this.name}_searches button`), this)
    }
    refreshBody() {
        // -- body
        this.scroll() // need to calculate virtual scrolling for columns
        let recHTML  = this.getRecordsHTML()
        let colHTML  = this.getColumnsHTML()
        let bodyHTML =
            '<div id="grid_'+ this.name +'_frecords" class="w2ui-grid-frecords" style="margin-bottom: '+ (w2utils.scrollBarSize() - 1) +'px;">'+
                recHTML[0] +
            '</div>'+
            '<div id="grid_'+ this.name +'_records" class="w2ui-grid-records" onscroll="w2ui[\''+ this.name +'\'].scroll(event);">' +
                recHTML[1] +
            '</div>'+
            '<div id="grid_'+ this.name +'_scroll1" class="w2ui-grid-scroll1" style="height: '+ w2utils.scrollBarSize() +'px"></div>'+
            // Columns need to be after to be able to overlap
            '<div id="grid_'+ this.name +'_fcolumns" class="w2ui-grid-fcolumns">'+
            '    <table><tbody>'+ colHTML[0] +'</tbody></table>'+
            '</div>'+
            '<div id="grid_'+ this.name +'_columns" class="w2ui-grid-columns">'+
            '    <table><tbody>'+ colHTML[1] +'</tbody></table>'+
            '</div>'
        let gridBody = $(this.box).find('#grid_'+ this.name +'_body', this.box).html(bodyHTML),
            records  = $(this.box).find('#grid_'+ this.name +'_records', this.box)
        let frecords = $(this.box).find('#grid_'+ this.name +'_frecords', this.box)
        let self     = this
        if (this.selectType == 'row') {
            records
                .on('mouseover mouseout', 'tr', function(event) {
                    $(self.box).find('#grid_'+ self.name +'_frec_' + w2utils.escapeId($(this).attr('recid'))).toggleClass('w2ui-record-hover', event.type == 'mouseover')
                })
            frecords
                .on('mouseover mouseout', 'tr', function(event) {
                    $(self.box).find('#grid_'+ self.name +'_rec_' + w2utils.escapeId($(this).attr('recid'))).toggleClass('w2ui-record-hover', event.type == 'mouseover')
                })
        }
        if (w2utils.isIOS)
            records.add(frecords)
                .on('click', 'tr', function(ev) {
                    self.dblClick($(this).attr('recid'), ev)
                })
        else
            records.add(frecords)
                .on('click', 'tr', function(ev) {
                    self.click($(this).attr('recid'), ev)
                })
                .on('contextmenu', 'tr', function(ev) {
                    self.contextMenu($(this).attr('recid'), null, ev)
                })
        // enable scrolling on frozen records,
        gridBody.data('scrolldata', { lastTime: 0, lastDelta: 0, time: 0 })
            .find('.w2ui-grid-frecords')
            .on('mousewheel DOMMouseScroll ', function(event) {
                event.preventDefault()
                let e = event.originalEvent,
                    scrolldata = gridBody.data('scrolldata'),
                    recordsContainer = $(this).siblings('.w2ui-grid-records').addBack().filter('.w2ui-grid-records'),
                    amount = typeof e.wheelDelta != null ? e.wheelDelta * -1 / 120 : (e.detail || e.deltaY) / 3, // normalizing scroll speed
                    newScrollTop = recordsContainer.scrollTop()
                scrolldata.time = +new Date()
                if (scrolldata.lastTime < scrolldata.time - 150) {
                    scrolldata.lastDelta = 0
                }
                scrolldata.lastTime   = scrolldata.time
                scrolldata.lastDelta += amount
                if (Math.abs(scrolldata.lastDelta) < 1) {
                    amount = 0
                } else {
                    amount = Math.round(scrolldata.lastDelta)
                }
                gridBody.data('scrolldata', scrolldata)
                // make scroll amount dependent on visible rows
                amount *= (Math.round(records.height() / self.recordHeight) - 1) * self.recordHeight / 4
                recordsContainer.stop().animate({ 'scrollTop': newScrollTop + amount }, 250, 'linear')
            })
        if (this.records.length === 0 && this.msgEmpty) {
            $(this.box).find('#grid_'+ this.name +'_body')
                .append('<div id="grid_'+ this.name + '_empty_msg" class="w2ui-grid-empty-msg"><div>'+ this.msgEmpty +'</div></div>')
        } else if ($(this.box).find('#grid_'+ this.name +'_empty_msg').length > 0) {
            $(this.box).find('#grid_'+ this.name +'_empty_msg').remove()
        }
        // show summary records
        if (this.summary.length > 0) {
            let sumHTML = this.getSummaryHTML()
            $(this.box).find('#grid_'+ this.name +'_fsummary').html(sumHTML[0]).show()
            $(this.box).find('#grid_'+ this.name +'_summary').html(sumHTML[1]).show()
        } else {
            $(this.box).find('#grid_'+ this.name +'_fsummary').hide()
            $(this.box).find('#grid_'+ this.name +'_summary').hide()
        }
    }
    render(box) {
        let obj  = this
        let time = (new Date()).getTime()
        if (box != null) {
            if ($(this.box).find('#grid_'+ this.name +'_body').length > 0) {
                $(this.box)
                    .removeAttr('name')
                    .removeClass('w2ui-reset w2ui-grid w2ui-inactive')
                    .html('')
            }
            this.box = box
        }
        if (!this.box) return
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        // event before
        let edata = this.trigger({ phase: 'before', target: this.name, type: 'render', box: box })
        if (edata.isCancelled === true) return
        // reset needed if grid existed
        this.reset(true)
        // --- default search field
        if (!this.last.field) {
            if (!this.multiSearch || !this.show.searchAll) {
                let tmp = 0
                while (tmp < this.searches.length && (this.searches[tmp].hidden || this.searches[tmp].simple === false)) tmp++
                if (tmp >= this.searches.length) {
                    // all searches are hidden
                    this.last.field = ''
                    this.last.label = ''
                } else {
                    this.last.field = this.searches[tmp].field
                    this.last.label = this.searches[tmp].label
                }
            } else {
                this.last.field = 'all'
                this.last.label = 'All Fields'
            }
        }
        // insert elements
        $(this.box)
            .attr('name', this.name)
            .addClass('w2ui-reset w2ui-grid w2ui-inactive')
            .html('<div class="w2ui-grid-box">'+
                  '    <div id="grid_'+ this.name +'_header" class="w2ui-grid-header"></div>'+
                  '    <div id="grid_'+ this.name +'_toolbar" class="w2ui-grid-toolbar"></div>'+
                  '    <div id="grid_'+ this.name +'_body" class="w2ui-grid-body"></div>'+
                  '    <div id="grid_'+ this.name +'_fsummary" class="w2ui-grid-body w2ui-grid-summary"></div>'+
                  '    <div id="grid_'+ this.name +'_summary" class="w2ui-grid-body w2ui-grid-summary"></div>'+
                  '    <div id="grid_'+ this.name +'_footer" class="w2ui-grid-footer"></div>'+
                  '    <textarea id="grid_'+ this.name +'_focus" class="w2ui-grid-focus-input" '+
                            (this.tabIndex ? 'tabindex="' + this.tabIndex + '"' : '')+
                            (w2utils.isIOS ? 'readonly' : '') +'></textarea>'+ // readonly needed on android not to open keyboard
                  '</div>')
        if (this.selectType != 'row') $(this.box).addClass('w2ui-ss')
        if ($(this.box).length > 0) $(this.box)[0].style.cssText += this.style
        // init toolbar
        this.initToolbar()
        if (this.toolbar != null) this.toolbar.render($(this.box).find('#grid_'+ this.name +'_toolbar')[0])
        this.last._toolbar_height = $(this.box).find(`#grid_${this.name}_toolbar`).prop('offsetHeight')
        // re-init search_all
        if (this.last.field && this.last.field != 'all') {
            let sd = this.searchData
            setTimeout(() => { this.searchInitInput(this.last.field, (sd.length == 1 ? sd[0].value : null)) }, 1)
        }
        // init footer
        $(this.box).find('#grid_'+ this.name +'_footer').html(this.getFooterHTML())
        // refresh
        if (!this.last.state) this.last.state = this.stateSave(true) // initial default state
        this.stateRestore()
        if (url) { this.clear(); this.refresh() } // show empty grid (need it) - should it be only for remote data source
        // if hidden searches - apply it
        let hasHiddenSearches = false
        for (let i = 0; i < this.searches.length; i++) {
            if (this.searches[i].hidden) { hasHiddenSearches = true; break }
        }
        if (hasHiddenSearches) {
            this.searchReset(false) // will call reload
            if (!url) setTimeout(() => { this.searchReset() }, 1)
        } else {
            this.reload()
        }
        // focus
        $(this.box).find('#grid_'+ this.name + '_focus')
            .on('focus', function (event) {
                clearTimeout(obj.last.kbd_timer)
                if (!obj.hasFocus) obj.focus()
            })
            .on('blur', function (event) {
                clearTimeout(obj.last.kbd_timer)
                obj.last.kbd_timer = setTimeout(() => {
                    if (obj.hasFocus) { obj.blur() }
                }, 100) // need this timer to be 100 ms
            })
            .on('paste', function (event) {
                let cd = (event.originalEvent.clipboardData ? event.originalEvent.clipboardData : null)
                if (cd) {
                    let items = cd.items
                    if (items.length == 2) {
                        if (items.length == 2 && items[1].kind == 'file') {
                            items = [items[1]]
                        }
                        if (items.length == 2 && items[0].type == 'text/plain' && items[1].type == 'text/html') {
                            items = [items[1]]
                        }
                    }
                    let items2send = []
                    // might contain data in different formats, but it is a single paste
                    for (let index in items) {
                        let item = items[index]
                        if (item.kind === 'file') {
                            let file = item.getAsFile()
                            items2send.push({ kind: 'file', data: file })
                        } else if (item.kind === 'string' && (item.type === 'text/plain' || item.type === 'text/html')) {
                            event.preventDefault()
                            let text = cd.getData('text/plain');
                            if (text.indexOf('\r') != -1 && text.indexOf('\n') == -1) {
                                text = text.replace(/\r/g, '\n');
                            }
                            items2send.push({ kind: (item.type == 'text/html' ? 'html' : 'text'), data: text })
                        }
                    }
                    if (items2send.length === 1 && items2send[0].kind != 'file') {
                        items2send = items2send[0].data
                    }
                    w2ui[obj.name].paste(items2send, event.originalEvent);
                    event.preventDefault()
                }
            })
            .on('keydown', function (event) {
                w2ui[obj.name].keydown.call(w2ui[obj.name], event)
            })
        // init mouse events for mouse selection
        let edataCol // event for column select
        $(this.box).off('mousedown.mouseStart').on('mousedown.mouseStart', mouseStart)
        this.updateToolbar()
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
        // observe div resize
        this.last.resizeObserver = new ResizeObserver(() => { this.resize() })
        this.last.resizeObserver.observe(this.box)
        return (new Date()).getTime() - time
        function mouseStart (event) {
            if (event.which != 1) return // if not left mouse button
            // restore css user-select
            if (obj.last.userSelect == 'text') {
                obj.last.userSelect = ''
                $(obj.box).find('.w2ui-grid-body').css(w2utils.cssPrefix('user-select', 'none'))
            }
            // regular record select
            if (obj.selectType == 'row' && ($(event.target).parents().hasClass('w2ui-head') || $(event.target).hasClass('w2ui-head'))) return
            if (obj.last.move && obj.last.move.type == 'expand') return
            // if altKey - alow text selection
            if (event.altKey) {
                $(obj.box).find('.w2ui-grid-body').css(w2utils.cssPrefix('user-select', 'text'))
                obj.selectNone()
                obj.last.move       = { type: 'text-select' }
                obj.last.userSelect = 'text'
            } else {
                let tmp  = event.target
                let pos  = {
                    x: event.offsetX - 10,
                    y: event.offsetY - 10
                }
                let tmps = false
                while (tmp) {
                    if (tmp.classList && tmp.classList.contains('w2ui-grid')) break
                    if (tmp.tagName && tmp.tagName.toUpperCase() == 'TD') tmps = true
                    if (tmp.tagName && tmp.tagName.toUpperCase() != 'TR' && tmps == true) {
                        pos.x += tmp.offsetLeft
                        pos.y += tmp.offsetTop
                    }
                    tmp = tmp.parentNode
                }
                obj.last.move = {
                    x      : event.screenX,
                    y      : event.screenY,
                    divX   : 0,
                    divY   : 0,
                    focusX : pos.x,
                    focusY : pos.y,
                    recid  : $(event.target).parents('tr').attr('recid'),
                    column : parseInt(event.target.tagName.toUpperCase() == 'TD' ? $(event.target).attr('col') : $(event.target).parents('td').attr('col')),
                    type   : 'select',
                    ghost  : false,
                    start  : true
                }
                if (obj.last.move.recid == null) obj.last.move.type = 'select-column'
                // set focus to grid
                let target = event.target
                let $input = $(obj.box).find('#grid_'+ obj.name + '_focus')
                // move input next to cursor so screen does not jump
                if (obj.last.move) {
                    let sLeft  = obj.last.move.focusX
                    let sTop   = obj.last.move.focusY
                    let $owner = $(target).parents('table').parent()
                    if ($owner.hasClass('w2ui-grid-records') || $owner.hasClass('w2ui-grid-frecords')
                            || $owner.hasClass('w2ui-grid-columns') || $owner.hasClass('w2ui-grid-fcolumns')
                            || $owner.hasClass('w2ui-grid-summary')) {
                        sLeft = obj.last.move.focusX - $(obj.box).find('#grid_'+ obj.name +'_records').scrollLeft()
                        sTop  = obj.last.move.focusY - $(obj.box).find('#grid_'+ obj.name +'_records').scrollTop()
                    }
                    if ($(target).hasClass('w2ui-grid-footer') || $(target).parents('div.w2ui-grid-footer').length > 0) {
                        sTop = $(obj.box).find('#grid_'+ obj.name +'_footer').position().top
                    }
                    // if clicked on toolbar
                    if ($owner.hasClass('w2ui-scroll-wrapper') && $owner.parent().hasClass('w2ui-toolbar')) {
                        sLeft = obj.last.move.focusX - $owner.scrollLeft()
                    }
                    $input.css({
                        left: sLeft - 10,
                        top : sTop
                    })
                }
                // if toolbar input is clicked
                setTimeout(() => {
                    if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(target.tagName.toUpperCase()) != -1) {
                        $(target).focus()
                    } else {
                        if (!$input.is(':focus')) $input.focus()
                    }
                }, 50)
                // disable click select for this condition
                if (!obj.multiSelect && !obj.reorderRows && obj.last.move.type == 'drag') {
                    delete obj.last.move
                }
            }
            if (obj.reorderRows == true) {
                let el = event.target
                if (el.tagName.toUpperCase() != 'TD') el = $(el).parents('td')[0]
                if ($(el).hasClass('w2ui-col-number') || $(el).hasClass('w2ui-col-order')) {
                    obj.selectNone()
                    obj.last.move.reorder = true
                    // suppress hover
                    let eColor = $(obj.box).find('.w2ui-even.w2ui-empty-record').css('background-color')
                    let oColor = $(obj.box).find('.w2ui-odd.w2ui-empty-record').css('background-color')
                    $(obj.box).find('.w2ui-even td').not('.w2ui-col-number').css('background-color', eColor)
                    $(obj.box).find('.w2ui-odd td').not('.w2ui-col-number').css('background-color', oColor)
                    // display empty record and ghost record
                    let mv = obj.last.move
                    let recs = $(obj.box).find('.w2ui-grid-records')
                    if (!mv.ghost) {
                        let row    = $(obj.box).find('#grid_'+ obj.name + '_rec_'+ mv.recid)
                        let tmp    = row.parents('table').find('tr:first-child').clone()
                        mv.offsetY = event.offsetY
                        mv.from    = mv.recid
                        mv.pos     = row.position()
                        mv.ghost   = $(row).clone(true)
                        mv.ghost.removeAttr('id')
                        row.find('td').remove()
                        row.append('<td colspan="1000"><div style="height: '+ obj.recordHeight +'px; background-color: #eee; border-bottom: 1px dashed #aaa; border-top: 1px dashed #aaa;"></div></td>')
                        recs.append('<div id="grid_'+ obj.name + '_ghost_line" style="position: absolute; z-index: 999999; pointer-events: none; width: 100%;"></div>')
                        recs.append('<table id="grid_'+ obj.name + '_ghost" style="position: absolute; z-index: 999998; opacity: 0.9; pointer-events: none;"></table>')
                        $(obj.box).find('#grid_'+ obj.name + '_ghost').append(tmp).append(mv.ghost)
                    }
                    let ghost = $(obj.box).find('#grid_'+ obj.name + '_ghost')
                    ghost.css({
                        top  : mv.pos.top,
                        left : mv.pos.left,
                        'border-top'    : '1px solid #aaa',
                        'border-bottom' : '1px solid #aaa'
                    })
                } else {
                    obj.last.move.reorder = false
                }
            }
            $(document)
                .on('mousemove.w2ui-' + obj.name, mouseMove)
                .on('mouseup.w2ui-' + obj.name, mouseStop)
            // needed when grid grids are nested, see issue #1275
            event.stopPropagation()
        }
        function mouseMove (event) {
            if (!event.target.tagName) {
                // element has no tagName - most likely the target is the #document itself
                // this can happen is you click+drag and move the mouse out of the DOM area,
                // e.g. into the browser's toolbar area
                return
            }
            let mv = obj.last.move
            if (!mv || ['select', 'select-column'].indexOf(mv.type) == -1) return
            mv.divX = (event.screenX - mv.x)
            mv.divY = (event.screenY - mv.y)
            if (Math.abs(mv.divX) <= 1 && Math.abs(mv.divY) <= 1) return // only if moved more then 1px
            obj.last.cancelClick = true
            if (obj.reorderRows == true && obj.last.move.reorder) {
                let tmp   = $(event.target).parents('tr')
                let recid = tmp.attr('recid')
                if (recid == '-none-') recid = 'bottom'
                if (recid != mv.from) {
                    // let row1 = $(obj.box).find('#grid_'+ obj.name + '_rec_'+ mv.recid)
                    let row2 = $(obj.box).find('#grid_'+ obj.name + '_rec_'+ recid)
                    $(obj.box).find('.insert-before')
                    row2.addClass('insert-before')
                    // MOVABLE GHOST
                    // if (event.screenY - mv.lastY < 0) row1.after(row2); else row2.after(row1);
                    mv.lastY = event.screenY
                    mv.to    = recid
                    // line to insert before
                    let pos        = row2.position()
                    let ghost_line = $(obj.box).find('#grid_'+ obj.name + '_ghost_line')
                    if (pos) {
                        ghost_line.css({
                            top  : pos.top,
                            left : mv.pos.left,
                            'border-top': '2px solid #769EFC'
                        })
                    } else {
                        ghost_line.css({
                            'border-top': '2px solid transparent'
                        })
                    }
                }
                let ghost = $(obj.box).find('#grid_'+ obj.name + '_ghost')
                ghost.css({
                    top  : mv.pos.top + mv.divY,
                    left : mv.pos.left
                })
                return
            }
            if (mv.start && mv.recid) {
                obj.selectNone()
                mv.start = false
            }
            let newSel = []
            let recid  = (event.target.tagName.toUpperCase() == 'TR' ? $(event.target).attr('recid') : $(event.target).parents('tr').attr('recid'))
            if (recid == null) {
                // select by dragging columns
                if (obj.selectType == 'row') return
                if (obj.last.move && obj.last.move.type == 'select') return
                let col = parseInt($(event.target).parents('td').attr('col'))
                if (isNaN(col)) {
                    obj.removeRange('column-selection')
                    $(obj.box).find('.w2ui-grid-columns .w2ui-col-header, .w2ui-grid-fcolumns .w2ui-col-header').removeClass('w2ui-col-selected')
                    $(obj.box).find('.w2ui-col-number').removeClass('w2ui-row-selected')
                    delete mv.colRange
                } else {
                    // add all columns in between
                    let newRange = col + '-' + col
                    if (mv.column < col) newRange = mv.column + '-' + col
                    if (mv.column > col) newRange = col + '-' + mv.column
                    // array of selected columns
                    let cols = []
                    let tmp  = newRange.split('-')
                    for (let ii = parseInt(tmp[0]); ii <= parseInt(tmp[1]); ii++) {
                        cols.push(ii)
                    }
                    if (mv.colRange != newRange) {
                        edataCol = obj.trigger({ phase: 'before', type: 'columnSelect', target: obj.name, columns: cols, isCancelled: false }) // initial isCancelled
                        if (edataCol.isCancelled !== true) {
                            if (mv.colRange == null) obj.selectNone()
                            // highlight columns
                            let tmp = newRange.split('-')
                            $(obj.box).find('.w2ui-grid-columns .w2ui-col-header, .w2ui-grid-fcolumns .w2ui-col-header').removeClass('w2ui-col-selected')
                            for (let j = parseInt(tmp[0]); j <= parseInt(tmp[1]); j++) {
                                $(obj.box).find('#grid_'+ obj.name +'_column_' + j + ' .w2ui-col-header').addClass('w2ui-col-selected')
                            }
                            $(obj.box).find('.w2ui-col-number').not('.w2ui-head').addClass('w2ui-row-selected')
                            // show new range
                            mv.colRange = newRange
                            obj.removeRange('column-selection')
                            obj.addRange({
                                name  : 'column-selection',
                                range : [{ recid: obj.records[0].recid, column: tmp[0] }, { recid: obj.records[obj.records.length-1].recid, column: tmp[1] }],
                                style : 'background-color: rgba(90, 145, 234, 0.1)'
                            })
                        }
                    }
                }
            } else { // regular selection
                let ind1 = obj.get(mv.recid, true)
                // this happens when selection is started on summary row
                if (ind1 == null || (obj.records[ind1] && obj.records[ind1].recid != mv.recid)) return
                let ind2 = obj.get(recid, true)
                // this happens when selection is extended into summary row (a good place to implement scrolling)
                if (ind2 == null) return
                let col1 = parseInt(mv.column)
                let col2 = parseInt(event.target.tagName.toUpperCase() == 'TD' ? $(event.target).attr('col') : $(event.target).parents('td').attr('col'))
                if (isNaN(col1) && isNaN(col2)) { // line number select entire record
                    col1 = 0
                    col2 = obj.columns.length-1
                }
                if (ind1 > ind2) { let tmp = ind1; ind1 = ind2; ind2 = tmp }
                // check if need to refresh
                let tmp = 'ind1:'+ ind1 +',ind2;'+ ind2 +',col1:'+ col1 +',col2:'+ col2
                if (mv.range == tmp) return
                mv.range = tmp
                for (let i = ind1; i <= ind2; i++) {
                    if (obj.last.searchIds.length > 0 && obj.last.searchIds.indexOf(i) == -1) continue
                    if (obj.selectType != 'row') {
                        if (col1 > col2) { let tmp = col1; col1 = col2; col2 = tmp }
                        for (let c = col1; c <= col2; c++) {
                            if (obj.columns[c].hidden) continue
                            newSel.push({ recid: obj.records[i].recid, column: parseInt(c) })
                        }
                    } else {
                        newSel.push(obj.records[i].recid)
                    }
                }
                if (obj.selectType != 'row') {
                    let sel = obj.getSelection()
                    // add more items
                    let tmp = []
                    for (let ns = 0; ns < newSel.length; ns++) {
                        let flag = false
                        for (let s = 0; s < sel.length; s++) if (newSel[ns].recid == sel[s].recid && newSel[ns].column == sel[s].column) flag = true
                        if (!flag) tmp.push({ recid: newSel[ns].recid, column: newSel[ns].column })
                    }
                    obj.select(tmp)
                    // remove items
                    tmp = []
                    for (let s = 0; s < sel.length; s++) {
                        let flag = false
                        for (let ns = 0; ns < newSel.length; ns++) if (newSel[ns].recid == sel[s].recid && newSel[ns].column == sel[s].column) flag = true
                        if (!flag) tmp.push({ recid: sel[s].recid, column: sel[s].column })
                    }
                    obj.unselect(tmp)
                } else {
                    if (obj.multiSelect) {
                        let sel = obj.getSelection()
                        for (let ns = 0; ns < newSel.length; ns++) {
                            if (sel.indexOf(newSel[ns]) == -1) obj.select(newSel[ns]) // add more items
                        }
                        for (let s = 0; s < sel.length; s++) {
                            if (newSel.indexOf(sel[s]) == -1) obj.unselect(sel[s]) // remove items
                        }
                    }
                }
            }
        }
        function mouseStop (event) {
            let mv = obj.last.move
            setTimeout(() => { delete obj.last.cancelClick }, 1)
            if ($(event.target).parents().hasClass('.w2ui-head') || $(event.target).hasClass('.w2ui-head')) return
            if (mv && ['select', 'select-column'].indexOf(mv.type) != -1) {
                if (mv.colRange != null && edataCol.isCancelled !== true) {
                    let tmp = mv.colRange.split('-')
                    let sel = []
                    for (let i = 0; i < obj.records.length; i++) {
                        let cols = []
                        for (let j = parseInt(tmp[0]); j <= parseInt(tmp[1]); j++) cols.push(j)
                        sel.push({ recid: obj.records[i].recid, column: cols })
                    }
                    obj.removeRange('column-selection')
                    obj.trigger($.extend(edataCol, { phase: 'after' }))
                    obj.select(sel)
                }
                if (obj.reorderRows == true && obj.last.move.reorder) {
                    if (mv.to != null) {
                        // event
                        let edata = obj.trigger({ phase: 'before', target: obj.name, type: 'reorderRow', recid: mv.from, moveBefore: mv.to })
                        if (edata.isCancelled === true) {
                            resetRowReorder()
                            delete obj.last.move
                            return
                        }
                        // default behavior
                        let ind1 = obj.get(mv.from, true)
                        let ind2 = obj.get(mv.to, true)
                        if (mv.to == 'bottom') ind2 = obj.records.length // end of list
                        let tmp = obj.records[ind1]
                        // swap records
                        if (ind1 != null && ind2 != null) {
                            obj.records.splice(ind1, 1)
                            if (ind1 > ind2) {
                                obj.records.splice(ind2, 0, tmp)
                            } else {
                                obj.records.splice(ind2 - 1, 0, tmp)
                            }
                        }
                        resetRowReorder()
                        // event after
                        obj.trigger($.extend(edata, { phase: 'after' }))
                    } else {
                        resetRowReorder()
                    }
                }
            }
            delete obj.last.move
            $(document).off('.w2ui-' + obj.name)
        }
        function resetRowReorder() {
            $(obj.box).find('#grid_'+ obj.name + '_ghost').remove()
            $(obj.box).find('#grid_'+ obj.name + '_ghost_line').remove()
            obj.refresh()
            delete obj.last.move
        }
    }
    destroy() {
        // event before
        let edata = this.trigger({ phase: 'before', target: this.name, type: 'destroy' })
        if (edata.isCancelled === true) return
        // remove all events
        $(this.box).off()
        // clean up
        if (typeof this.toolbar == 'object' && this.toolbar.destroy) this.toolbar.destroy()
        if ($(this.box).find('#grid_'+ this.name +'_body').length > 0) {
            $(this.box)
                .removeAttr('name')
                .removeClass('w2ui-reset w2ui-grid w2ui-inactive')
                .html('')
        }
        this.last.resizeObserver?.disconnect()
        delete w2ui[this.name]
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
    }
    // ===========================================
    // --- Internal Functions
    initColumnOnOff() {
        if (!this.show.toolbarColumns) return
        let items = [
            { id: 'line-numbers', text: 'Line #', checked: this.show.lineNumbers }
        ]
        // columns
        for (let c = 0; c < this.columns.length; c++) {
            let col = this.columns[c]
            let text = this.columns[c].text
            if (col.hideable === false) continue
            if (!text && this.columns[c].tooltip) text = this.columns[c].tooltip
            if (!text) text = '- column '+ (parseInt(c) + 1) +' -'
            items.push({ id: col.field, text: w2utils.stripTags(text), checked: !col.hidden })
        }
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if ((url && this.show.skipRecords) || this.show.saveRestoreState) {
            items.push({ text: '--' })
        }
        // skip records
        if (url && this.show.skipRecords) {
            let skip =  `
                ${w2utils.lang('Skip')}
                <input id="${this.name}_skip" type="text" style="width: 60px" value="${his.offset}"
                    onkeydown="if ([48,49,50,51,52,53,54,55,56,57,58,13,8,46,37,39].indexOf(event.keyCode) == -1) { event.preventDefault() }"
                    onkeypress="if (event.keyCode == 13) {
                        w2ui['${this.name}'].skip(this.value);
                    }">
                ${w2utils.lang('records')}
            `
            items.push({ id: '', test: skip, group: false, icon: 'w2ui-icon-empty' })
        }
        // save/restore state
        if (this.show.saveRestoreState) {
            items.push(
                { id: 'stateSave', text: w2utils.lang('Save Grid State'), icon: 'w2ui-icon-empty', group: false },
                { id: 'stateReset', text: w2utils.lang('Restore Default State'), icon: 'w2ui-icon-empty', group: false }
            )
        }
        let selected = []
        items.forEach(item => {
            item.text = w2utils.lang(item.text) // translate
            if (item.checked) selected.push(item.id)
        })
        this.toolbar.set('w2ui-column-on-off', { selected, items })
        return items
    }
    /**
     *
     * @param box, grid object
     * @returns {{remove: Function}} contains a closure around all events to ensure they are removed from the dom
     */
    initColumnDrag(box) {
        //throw error if using column groups
        if (this.columnGroups && this.columnGroups.length) throw 'Draggable columns are not currently supported with column groups.'
        let obj           = this
        let _dragData     = {}
        _dragData.lastInt = undefined
        _dragData.pressed = false
        _dragData.timeout = null
        _dragData.columnHead = null
        // attach original event listener
        $(obj.box).off('mousedown.colDrag').on('mousedown.colDrag', dragColStart)
        $(obj.box).off('mouseup.colDrag').on('mouseup.colDrag', catchMouseup)
        function catchMouseup(){
            _dragData.pressed = false
            clearTimeout(_dragData.timeout)
        }
        /**
         *
         * @param event, mousedown
         * @returns {boolean} false, preventsDefault
         */
        function dragColStart (event) {
            if (_dragData.timeout) clearTimeout(_dragData.timeout)
            let self          = this
            _dragData.pressed = true
            _dragData.timeout = setTimeout(() => {
                // When dragging a column for reordering, a quick release and a secondary
                // click may result in a bug where the column is ghosted to the screen,
                // but can no longer be docked back into the header.  It simply floats and you
                // can no longer interact with it.
                // The erroneous event thats fired will have _dragData.numberPreColumnsPresent === 0
                // populated, whereas a valid event will not.
                // if we see the erroneous event, do not allow that second click to register, which results
                // in the floating column remaining under the mouse's control.
                if (!_dragData.pressed || _dragData.numberPreColumnsPresent === 0) return
                let edata,
                    columns,
                    selectedCol,
                    origColumn,
                    origColumnNumber,
                    invalidPreColumns = [ 'w2ui-col-number', 'w2ui-col-expand', 'w2ui-col-select' ],
                    invalidPostColumns = [ 'w2ui-head-last' ],
                    invalidColumns = invalidPreColumns.concat(invalidPostColumns),
                    preColumnsSelector = '.w2ui-col-number, .w2ui-col-expand, .w2ui-col-select',
                    preColHeadersSelector = '.w2ui-head.w2ui-col-number, .w2ui-head.w2ui-col-expand, .w2ui-head.w2ui-col-select'
                // do nothing if it is not a header
                if (!$(event.originalEvent.target).parents().hasClass('w2ui-head')) return
                // do nothing if it is an invalid column
                for (let i = 0, l = invalidColumns.length; i < l; i++){
                    if ($(event.originalEvent.target).parents().hasClass(invalidColumns[ i ])) return
                }
                _dragData.numberPreColumnsPresent = $(obj.box).find(preColHeadersSelector).length
                //start event for drag start
                _dragData.columnHead  = origColumn = $(event.originalEvent.target).parents('.w2ui-head')
                _dragData.originalPos = origColumnNumber = parseInt(origColumn.attr('col'), 10)
                edata                 = obj.trigger({ type: 'columnDragStart', phase: 'before', originalEvent: event, origColumnNumber: origColumnNumber, target: origColumn[0] })
                if (edata.isCancelled === true) return false
                columns = _dragData.columns = $(obj.box).find('.w2ui-head:not(.w2ui-head-last)')
                // add events
                $(document).on('mouseup', dragColEnd)
                $(document).on('mousemove', dragColOver)
                //_dragData.columns.css({ overflow: 'visible' }).children('div').css({ overflow: 'visible' });
                //configure and style ghost image
                _dragData.ghost = $(self).clone(true)
                //hide other elements on ghost except the grid body
                $(_dragData.ghost).find('[col]:not([col="' + _dragData.originalPos + '"]), .w2ui-toolbar, .w2ui-grid-header').remove()
                $(_dragData.ghost).find(preColumnsSelector).remove()
                $(_dragData.ghost).find('.w2ui-grid-body').css({ top: 0 })
                selectedCol = $(_dragData.ghost).find('[col="' + _dragData.originalPos + '"]')
                $(document.body).append(_dragData.ghost)
                $(_dragData.ghost).css({
                    width: 0,
                    height: 0,
                    margin: 0,
                    position: 'fixed',
                    zIndex: 999999,
                    opacity: 0
                }).addClass('.w2ui-grid-ghost').animate({
                    width: selectedCol.width(),
                    height: $(obj.box).find('.w2ui-grid-body').first().height(),
                    left : event.pageX,
                    top : event.pageY,
                    opacity: 0.8
                }, 0)
                // establish current offsets
                _dragData.offsets = []
                for (let i = 0, l = columns.length; i < l; i++) {
                    _dragData.offsets.push($(columns[ i ]).offset().left)
                }
                // conclude event
                obj.trigger($.extend(edata, { phase: 'after' }))
            }, 150)//end timeout wrapper
        }
        function dragColOver(event) {
            if (!_dragData.pressed) return
            let cursorX = event.originalEvent.pageX,
                cursorY = event.originalEvent.pageY,
                offsets = _dragData.offsets,
                lastWidth = $('.w2ui-head:not(.w2ui-head-last)').width()
            _dragData.targetInt = Math.max(_dragData.numberPreColumnsPresent,targetIntersection(cursorX, offsets, lastWidth))
            markIntersection(_dragData.targetInt)
            trackGhost(cursorX, cursorY)
        }
        function dragColEnd(event) {
            _dragData.pressed = false
            let edata,
                target,
                selected,
                columnConfig,
                targetColumn,
                ghosts = $(obj.box).find('.w2ui-grid-ghost')
            //start event for drag start
            edata = obj.trigger({ type: 'columnDragEnd', phase: 'before', originalEvent: event, target: _dragData.columnHead[0] })
            if (edata.isCancelled === true) return false
            selected     = obj.columns[ _dragData.originalPos ]
            columnConfig = obj.columns
            targetColumn = $(_dragData.columns[ Math.min(_dragData.lastInt, _dragData.columns.length - 1) ])
            target       = (_dragData.lastInt < _dragData.columns.length) ? parseInt(targetColumn.attr('col')) : columnConfig.length
            if (target !== _dragData.originalPos + 1 && target !== _dragData.originalPos && targetColumn && targetColumn.length) {
                $(_dragData.ghost).animate({
                    top: $(obj.box).offset().top,
                    left: targetColumn.offset().left,
                    width: 0,
                    height: 0,
                    opacity: 0.2
                }, 300, function() {
                    $(this).remove()
                    ghosts.remove()
                })
                columnConfig.splice(target, 0, $.extend({}, selected))
                columnConfig.splice(columnConfig.indexOf(selected), 1)
            } else {
                $(_dragData.ghost).remove()
                ghosts.remove()
            }
            //_dragData.columns.css({ overflow: '' }).children('div').css({ overflow: '' });
            $(document).off('mouseup', dragColEnd)
            $(document).off('mousemove', dragColOver)
            if (_dragData.marker) _dragData.marker.remove()
            _dragData = {}
            obj.refresh()
            //conclude event
            obj.trigger($.extend(edata, { phase: 'after', targetColumnNumber: target - 1 }))
        }
        function markIntersection(intersection){
            if (!_dragData.marker && !_dragData.markerLeft) {
                _dragData.marker     = $('<div class="col-intersection-marker">' +
                    '<div class="top-marker"></div>' +
                    '<div class="bottom-marker"></div>' +
                    '</div>')
                _dragData.markerLeft = $('<div class="col-intersection-marker">' +
                    '<div class="top-marker"></div>' +
                    '<div class="bottom-marker"></div>' +
                    '</div>')
            }
            if (!_dragData.lastInt || _dragData.lastInt !== intersection){
                _dragData.lastInt = intersection
                _dragData.marker.remove()
                _dragData.markerLeft.remove()
                $('.w2ui-head').removeClass('w2ui-col-intersection')
                //if the current intersection is greater than the number of columns add the marker to the end of the last column only
                if (intersection >= _dragData.columns.length) {
                    $(_dragData.columns[ _dragData.columns.length - 1 ]).children('div:last').append(_dragData.marker.addClass('right').removeClass('left'))
                    $(_dragData.columns[ _dragData.columns.length - 1 ]).addClass('w2ui-col-intersection')
                } else if (intersection <= _dragData.numberPreColumnsPresent) {
                    //if the current intersection is on the column numbers place marker on first available column only
                    $(_dragData.columns[ _dragData.numberPreColumnsPresent ]).prepend(_dragData.marker.addClass('left').removeClass('right')).css({ position: 'relative' })
                    $(_dragData.columns[ _dragData.numberPreColumnsPresent ]).prev().addClass('w2ui-col-intersection')
                } else {
                    //otherwise prepend the marker to the targeted column and append it to the previous column
                    $(_dragData.columns[intersection]).children('div:last').prepend(_dragData.marker.addClass('left').removeClass('right'))
                    $(_dragData.columns[intersection]).prev().children('div:last').append(_dragData.markerLeft.addClass('right').removeClass('left')).css({ position: 'relative' })
                    $(_dragData.columns[intersection - 1]).addClass('w2ui-col-intersection')
                }
            }
        }
        function targetIntersection(cursorX, offsets, lastWidth){
            if (cursorX <= offsets[0]) {
                return 0
            } else if (cursorX >= offsets[offsets.length - 1] + lastWidth) {
                return offsets.length
            } else {
                for (let i = 0, l = offsets.length; i < l; i++) {
                    let thisOffset = offsets[ i ]
                    let nextOffset = offsets[ i + 1 ] || offsets[ i ] + lastWidth
                    let midpoint   = (nextOffset - offsets[ i ]) / 2 + offsets[ i ]
                    if (cursorX > thisOffset && cursorX <= midpoint) {
                        return i
                    } else if (cursorX > midpoint && cursorX <= nextOffset) {
                        return i + 1
                    }
                }
                return 0
            }
        }
        function trackGhost(cursorX, cursorY){
            $(_dragData.ghost).css({
                left: cursorX - 10,
                top: cursorY - 10
            })
        }
        //return an object to remove drag if it has ever been enabled
        return {
            remove(){
                $(obj.box).off('mousedown.colDrag', dragColStart)
                $(obj.box).off('mouseup.colDrag', catchMouseup)
                $(obj.box).find('.w2ui-head').removeAttr('draggable')
                obj.last.columnDrag = false
            }
        }
    }
    columnOnOff(event, field) {
        // event before
        let edata = this.trigger('columnOnOff', { target: this.name, field: field, originalEvent: event })
        if (edata.isCancelled === true) return
        // collapse expanded rows
        let rows = this.find({ 'w2ui.expanded': true }, true)
        for (let r = 0; r < rows.length; r++) {
            let tmp = this.records[r].w2ui
            if (tmp && !Array.isArray(tmp.children)) {
                this.records[r].w2ui.expanded = false
            }
        }
        // show/hide
        if (field == 'line-numbers') {
            this.show.lineNumbers = !this.show.lineNumbers
            this.refresh()
        } else {
            let col = this.getColumn(field)
            if (col.hidden) {
                this.showColumn(col.field)
            } else {
                this.hideColumn(col.field)
            }
        }
        // event after
        edata.finish()
    }
    initToolbar() {
        let self = this
        // if it is already initiazlied
        if (this.toolbar.render != null) {
            return
        }
        let tb_items = this.toolbar.items || []
        this.toolbar.items = []
        this.toolbar = new w2toolbar(w2utils.extend({}, this.toolbar, { name: this.name +'_toolbar', owner: this }))
        if (this.show.toolbarReload) {
            this.toolbar.items.push(w2utils.extend({}, this.buttons.reload))
        }
        if (this.show.toolbarColumns) {
            this.toolbar.items.push(w2utils.extend({}, this.buttons.columns))
        }
        if (this.show.toolbarSearch) {
            let html =`
                <div class="w2ui-grid-search-input">
                    ${this.buttons.search.html}
                    <div id="grid_${this.name}_search_name" class="w2ui-grid-search-name">
                        <span class="name-icon w2ui-icon-search"></span>
                        <span class="name-text"></span>
                        <span class="name-cross w2ui-action" data-click="searchReset">x</span>
                    </div>
                    <input type="text" id="grid_${this.name}_search_all" class="w2ui-search-all" tabindex="-1"
                        autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"
                        placeholder="${w2utils.lang(this.last.label, true)}" value="${this.last.search}"
                        data-focus="searchSuggest" data-click="stop"
                    >
                    <div class="w2ui-search-drop w2ui-action" data-click="searchOpen"
                            style="${this.multiSearch ? '' : 'display: none'}">
                        <span class="w2ui-icon-drop"></span>
                    </div>
                </div>`
            this.toolbar.items.push({
                id: 'w2ui-search',
                type: 'html',
                html,
                onRefresh(event) {
                    event.done(() => {
                        let input = query(this.box).find(`#grid_${self.name}_search_all`)
                        w2utils.bindEvents(query(this.box).find(`#grid_${self.name}_search_all, .w2ui-action`), self)
                        input.on('change', function (event) {
                            let val = this.value
                            let sel = jQuery(this).data('selected')
                            let fld = jQuery(this).data('w2field')
                            if (fld) val = fld.clean(val)
                            if (fld && fld.type == 'list' && sel && typeof sel.id == 'undefined') {
                                self.searchReset()
                            } else {
                                self.search(self.last.field, val)
                            }
                            self.searchSuggest(true, true, this)
                        })
                            .on('keydown', function(event) {
                                if (event.keyCode == 40) {
                                    self.searchSuggest(true)
                                }
                            })
                    })
                }
            })
        }
        if (Array.isArray(tb_items)) {
            let ids = tb_items.map(item => item.id)
            if (this.show.toolbarAdd && !ids.includes(this.buttons.add.id)) {
                this.toolbar.items.push(w2utils.extend({}, this.buttons.add))
            }
            if (this.show.toolbarEdit && !ids.includes(this.buttons.edit.id)) {
                this.toolbar.items.push(w2utils.extend({}, this.buttons.edit))
            }
            if (this.show.toolbarDelete && !ids.includes(this.buttons.delete.id)) {
                this.toolbar.items.push(w2utils.extend({}, this.buttons.delete))
            }
            if (this.show.toolbarSave && !ids.includes(this.buttons.save.id)) {
                if (this.show.toolbarAdd || this.show.toolbarDelete || this.show.toolbarEdit) {
                    this.toolbar.items.push({ type: 'break', id: 'w2ui-break2' })
                }
                this.toolbar.items.push(w2utils.extend({}, this.buttons.save))
            }
        }
        // add original buttons
        this.toolbar.items.push(...tb_items)
        // =============================================
        // ------ Toolbar onClick processing
        this.toolbar.on('click', (event) => {
            let edata = this.trigger('toolbar', { target: event.target, originalEvent: event })
            if (edata.isCancelled === true) return
            let edata2
            switch (event.detail.item.id) {
                case 'w2ui-reload':
                    edata2 = this.trigger('reload', { target: this.name })
                    if (edata2.isCancelled === true) return false
                    this.reload()
                    edata2.finish()
                    break
                case 'w2ui-column-on-off':
                    if (event.detail.subItem) {
                        let id = event.detail.subItem.id
                        if (['stateSave', 'stateReset'].includes(id)) {
                            debugger
                            this[id]()
                        } else {
                            this.columnOnOff(event, event.detail.subItem.id)
                        }
                    } else {
                        console.log(this.initColumnOnOff())
                        this.initResize() // TODO: is it needed?
                        this.resize()
                    }
                    break
                case 'w2ui-add':
                    // events
                    edata2 = this.trigger('add', { target: this.name, recid: null })
                    if (edata2.isCancelled === true) return false
                    edata2.finish()
                    break
                case 'w2ui-edit': {
                    let sel   = this.getSelection()
                    let recid = null
                    if (sel.length == 1) recid = sel[0]
                    // events
                    edata2 = this.trigger('edit', { target: this.name, recid: recid })
                    if (edata2.isCancelled === true) return false
                    edata2.finish()
                    break
                }
                case 'w2ui-delete':
                    this.delete()
                    break
                case 'w2ui-save':
                    this.save()
                    break
            }
            // no default action
            edata.finish()
        })
        this.toolbar.on('refresh', (event) => {
            if (event.target == 'w2ui-search') {
                let sd = this.searchData
                setTimeout(() => {
                    this.searchInitInput(this.last.field, (sd.length == 1 ? sd[0].value : null))
                }, 1)
            }
        })
    }
    initResize() {
        let obj = this
        $(this.box).find('.w2ui-resizer')
            .off('.grid-col-resize')
            .on('click.grid-col-resize', function(event) {
                if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true
                if (event.preventDefault) event.preventDefault()
            })
            .on('mousedown.grid-col-resize', function(event) {
                if (!event) event = window.event
                obj.last.colResizing = true
                obj.last.tmp         = {
                    x   : event.screenX,
                    y   : event.screenY,
                    gx  : event.screenX,
                    gy  : event.screenY,
                    col : parseInt($(this).attr('name'))
                }
                // find tds that will be resized
                obj.last.tmp.tds = $(obj.box).find('#grid_'+ obj.name +'_body table tr:first-child td[col='+ obj.last.tmp.col +']')
                if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true
                if (event.preventDefault) event.preventDefault()
                // fix sizes
                for (let c = 0; c < obj.columns.length; c++) {
                    if (obj.columns[c].hidden) continue
                    if (obj.columns[c].sizeOriginal == null) obj.columns[c].sizeOriginal = obj.columns[c].size
                    obj.columns[c].size = obj.columns[c].sizeCalculated
                }
                let edata = { phase: 'before', type: 'columnResize', target: obj.name, column: obj.last.tmp.col, field: obj.columns[obj.last.tmp.col].field }
                edata     = obj.trigger($.extend(edata, { resizeBy: 0, originalEvent: event }))
                // set move event
                let timer
                let mouseMove = function(event) {
                    if (obj.last.colResizing != true) return
                    if (!event) event = window.event
                    // event before
                    edata = obj.trigger($.extend(edata, { resizeBy: (event.screenX - obj.last.tmp.gx), originalEvent: event }))
                    if (edata.isCancelled === true) { edata.isCancelled = false; return }
                    // default action
                    obj.last.tmp.x                     = (event.screenX - obj.last.tmp.x)
                    obj.last.tmp.y                     = (event.screenY - obj.last.tmp.y)
                    let newWidth                       = (parseInt(obj.columns[obj.last.tmp.col].size) + obj.last.tmp.x) + 'px'
                    obj.columns[obj.last.tmp.col].size = newWidth
                    if (timer) clearTimeout(timer)
                    timer = setTimeout(() => {
                        obj.resizeRecords()
                        obj.scroll()
                    }, 100)
                    // quick resize
                    obj.last.tmp.tds.css({ width: newWidth })
                    // reset
                    obj.last.tmp.x = event.screenX
                    obj.last.tmp.y = event.screenY
                }
                let mouseUp = function(event) {
                    $(document).off('.grid-col-resize')
                    obj.resizeRecords()
                    obj.scroll()
                    // event after
                    obj.trigger($.extend(edata, { phase: 'after', originalEvent: event }))
                    // need timeout to finish processing events
                    setTimeout(() => { obj.last.colResizing = false }, 1)
                }
                $(document)
                    .off('.grid-col-resize')
                    .on('mousemove.grid-col-resize', mouseMove)
                    .on('mouseup.grid-col-resize', mouseUp)
            })
            .on('dblclick.grid-col-resize', function(event) {
                let colId = parseInt($(this).attr('name')),
                    col = obj.columns[colId],
                    maxDiff = 0
                if (col.autoResize === false) {
                    return true
                }
                if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true
                if (event.preventDefault) event.preventDefault()
                $(obj.box).find('.w2ui-grid-records td[col="' + colId + '"] > div', obj.box).each(() => {
                    let thisDiff = this.offsetWidth - this.scrollWidth
                    if (thisDiff < maxDiff) {
                        maxDiff = thisDiff - 3 // 3px buffer needed for Firefox
                    }
                })
                // event before
                let edata = { phase: 'before', type: 'columnAutoResize', target: obj.name, column: col, field: col.field }
                edata     = obj.trigger($.extend(edata, { resizeBy: Math.abs(maxDiff), originalEvent: event }))
                if (edata.isCancelled === true) { edata.isCancelled = false; return }
                if (maxDiff < 0) {
                    col.size = Math.min(parseInt(col.size) + Math.abs(maxDiff), col.max || Infinity) + 'px'
                    obj.resizeRecords()
                    obj.resizeRecords() // Why do we have to call it twice in order to show the scrollbar?
                    obj.scroll()
                }
                // event after
                obj.trigger($.extend(edata, { phase: 'after', originalEvent: event }))
            })
            .each((index, el) => {
                let td = $(el).parent()
                $(el).css({
                    'height'      : td.height(),
                    'margin-left' : (td.width() - 3) + 'px'
                })
            })
    }
    resizeBoxes() {
        // elements
        let header   = $(this.box).find('#grid_'+ this.name +'_header')
        let toolbar  = $(this.box).find('#grid_'+ this.name +'_toolbar')
        let fsummary = $(this.box).find('#grid_'+ this.name +'_fsummary')
        let summary  = $(this.box).find('#grid_'+ this.name +'_summary')
        let footer   = $(this.box).find('#grid_'+ this.name +'_footer')
        let body     = $(this.box).find('#grid_'+ this.name +'_body')
        if (this.show.header) {
            header.css({
                top:   '0px',
                left:  '0px',
                right: '0px'
            })
        }
        if (this.show.toolbar) {
            toolbar.css({
                top:   (0 + (this.show.header ? w2utils.getSize(header, 'height') : 0)) + 'px',
                left:  '0px',
                right: '0px'
            })
        }
        if (this.summary.length > 0) {
            fsummary.css({
                bottom: (0 + (this.show.footer ? w2utils.getSize(footer, 'height') : 0)) + 'px'
            })
            summary.css({
                bottom: (0 + (this.show.footer ? w2utils.getSize(footer, 'height') : 0)) + 'px',
                right: '0px'
            })
        }
        if (this.show.footer) {
            footer.css({
                bottom: '0px',
                left:  '0px',
                right: '0px'
            })
        }
        body.css({
            top: (0 + (this.show.header ? w2utils.getSize(header, 'height') : 0) + (this.show.toolbar ? w2utils.getSize(toolbar, 'height') : 0)) + 'px',
            bottom: (0 + (this.show.footer ? w2utils.getSize(footer, 'height') : 0) + (this.summary.length > 0 ? w2utils.getSize(summary, 'height') : 0)) + 'px',
            left:   '0px',
            right:  '0px'
        })
    }
    resizeRecords() {
        let obj = this
        // remove empty records
        $(this.box).find('.w2ui-empty-record').remove()
        // -- Calculate Column size in PX
        let box             = $(this.box)
        let grid            = $(this.box).find('> div.w2ui-grid-box')
        let header          = $(this.box).find('#grid_'+ this.name +'_header')
        let toolbar         = $(this.box).find('#grid_'+ this.name +'_toolbar')
        let summary         = $(this.box).find('#grid_'+ this.name +'_summary')
        let fsummary        = $(this.box).find('#grid_'+ this.name +'_fsummary')
        let footer          = $(this.box).find('#grid_'+ this.name +'_footer')
        let body            = $(this.box).find('#grid_'+ this.name +'_body')
        let columns         = $(this.box).find('#grid_'+ this.name +'_columns')
        let fcolumns        = $(this.box).find('#grid_'+ this.name +'_fcolumns')
        let records         = $(this.box).find('#grid_'+ this.name +'_records')
        let frecords        = $(this.box).find('#grid_'+ this.name +'_frecords')
        let scroll1         = $(this.box).find('#grid_'+ this.name +'_scroll1')
        let lineNumberWidth = String(this.total).length * 8 + 10
        if (lineNumberWidth < 34) lineNumberWidth = 34 // 3 digit width
        if (this.lineNumberWidth != null) lineNumberWidth = this.lineNumberWidth
        let bodyOverflowX = false
        let bodyOverflowY = false
        let sWidth        = 0
        for (let i = 0; i < this.columns.length; i++) {
            if (this.columns[i].frozen || this.columns[i].hidden) continue
            let cSize = parseInt(this.columns[i].sizeCalculated ? this.columns[i].sizeCalculated : this.columns[i].size)
            sWidth   += cSize
        }
        if (records.width() < sWidth) bodyOverflowX = true
        if (body.height() - columns.height() < $(records).find('>table').height() + (bodyOverflowX ? w2utils.scrollBarSize() : 0)) bodyOverflowY = true
        // body might be expanded by data
        if (!this.fixedBody) {
            // allow it to render records, then resize
            let calculatedHeight = w2utils.getSize(columns, 'height')
                + w2utils.getSize($(this.box).find('#grid_'+ this.name +'_records table'), 'height')
                + (bodyOverflowX ? w2utils.scrollBarSize() : 0)
            this.height = calculatedHeight
                + (this.show.header ? w2utils.getSize(header, 'height') : 0)
                + (this.show.toolbar ? w2utils.getSize(toolbar, 'height') : 0)
                + (summary.css('display') != 'none' ? w2utils.getSize(summary, 'height') : 0)
                + (this.show.footer ? w2utils.getSize(footer, 'height') : 0)
            grid.css('height', this.height)
            body.css('height', calculatedHeight)
            box.css('height', w2utils.getSize(grid, 'height'))
        } else {
            // fixed body height
            let calculatedHeight = grid.height()
                - (this.show.header ? w2utils.getSize(header, 'height') : 0)
                - (this.show.toolbar ? w2utils.getSize(toolbar, 'height') : 0)
                - (summary.css('display') != 'none' ? w2utils.getSize(summary, 'height') : 0)
                - (this.show.footer ? w2utils.getSize(footer, 'height') : 0)
            body.css('height', calculatedHeight)
        }
        let buffered = this.records.length
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if (this.searchData.length != 0 && !url) buffered = this.last.searchIds.length
        // apply overflow
        if (!this.fixedBody) { bodyOverflowY = false }
        if (bodyOverflowX || bodyOverflowY) {
            columns.find('> table > tbody > tr:nth-child(1) td.w2ui-head-last').css('width', w2utils.scrollBarSize()).show()
            records.css({
                top: ((this.columnGroups.length > 0 && this.show.columns ? 1 : 0) + w2utils.getSize(columns, 'height')) +'px',
                '-webkit-overflow-scrolling': 'touch',
                'overflow-x': (bodyOverflowX ? 'auto' : 'hidden'),
                'overflow-y': (bodyOverflowY ? 'auto' : 'hidden')
            })
        } else {
            columns.find('> table > tbody > tr:nth-child(1) td.w2ui-head-last').hide()
            records.css({
                top: ((this.columnGroups.length > 0 && this.show.columns ? 1 : 0) + w2utils.getSize(columns, 'height')) +'px',
                overflow: 'hidden'
            })
            if (records.length > 0) { this.last.scrollTop = 0; this.last.scrollLeft = 0 } // if no scrollbars, always show top
        }
        if (bodyOverflowX) {
            frecords.css('margin-bottom', w2utils.scrollBarSize())
            scroll1.show()
        } else {
            frecords.css('margin-bottom', 0)
            scroll1.hide()
        }
        frecords.css({ overflow: 'hidden', top: records.css('top') })
        if (this.show.emptyRecords && !bodyOverflowY) {
            let max      = Math.floor(records.height() / this.recordHeight) - 1
            let leftover = 0
            if (records[0]) leftover = records[0].scrollHeight - max * this.recordHeight
            if (leftover >= this.recordHeight) {
                leftover -= this.recordHeight
                max++
            }
            if (this.fixedBody) {
                for (let di = buffered; di < max; di++) {
                    addEmptyRow(di, this.recordHeight, this)
                }
                addEmptyRow(max, leftover, this)
            }
        }
        function addEmptyRow(row, height, grid) {
            let html1 = ''
            let html2 = ''
            let htmlp = ''
            html1    += '<tr class="'+ (row % 2 ? 'w2ui-even' : 'w2ui-odd') + ' w2ui-empty-record" recid="-none-" style="height: '+ height +'px">'
            html2    += '<tr class="'+ (row % 2 ? 'w2ui-even' : 'w2ui-odd') + ' w2ui-empty-record" recid="-none-" style="height: '+ height +'px">'
            if (grid.show.lineNumbers) html1 += '<td class="w2ui-col-number"></td>'
            if (grid.show.selectColumn) html1 += '<td class="w2ui-grid-data w2ui-col-select"></td>'
            if (grid.show.expandColumn) html1 += '<td class="w2ui-grid-data w2ui-col-expand"></td>'
            html2 += '<td class="w2ui-grid-data-spacer" col="start" style="border-right: 0"></td>'
            if (grid.show.orderColumn) html2 += '<td class="w2ui-grid-data w2ui-col-order" col="order"></td>'
            for (let j = 0; j < grid.columns.length; j++) {
                let col = grid.columns[j]
                if ((col.hidden || j < grid.last.colStart || j > grid.last.colEnd) && !col.frozen) continue
                htmlp = '<td class="w2ui-grid-data" '+ (col.attr != null ? col.attr : '') +' col="'+ j +'"></td>'
                if (col.frozen) html1 += htmlp; else html2 += htmlp
            }
            html1 += '<td class="w2ui-grid-data-last"></td> </tr>'
            html2 += '<td class="w2ui-grid-data-last" col="end"></td> </tr>'
            $(grid.box).find('#grid_'+ grid.name +'_frecords > table').append(html1)
            $(grid.box).find('#grid_'+ grid.name +'_records > table').append(html2)
        }
        let width_box, percent
        if (body.length > 0) {
            let width_max = parseInt(body.width())
                - (bodyOverflowY ? w2utils.scrollBarSize() : 0)
                - (this.show.lineNumbers ? lineNumberWidth : 0)
                // - (this.show.orderColumn ? 26 : 0)
                - (this.show.selectColumn ? 26 : 0)
                - (this.show.expandColumn ? 26 : 0)
                - 1 // left is 1xp due to border width
            width_box     = width_max
            percent       = 0
            // gridMinWidth processing
            let restart = false
            for (let i = 0; i < this.columns.length; i++) {
                let col = this.columns[i]
                if (col.gridMinWidth > 0) {
                    if (col.gridMinWidth > width_box && col.hidden !== true) {
                        col.hidden = true
                        restart    = true
                    }
                    if (col.gridMinWidth < width_box && col.hidden === true) {
                        col.hidden = false
                        restart    = true
                    }
                }
            }
            if (restart === true) {
                this.refresh()
                return
            }
            // assign PX column s
            for (let i = 0; i < this.columns.length; i++) {
                let col = this.columns[i]
                if (col.hidden) continue
                if (String(col.size).substr(String(col.size).length-2).toLowerCase() == 'px') {
                    width_max                     -= parseFloat(col.size)
                    this.columns[i].sizeCalculated = col.size
                    this.columns[i].sizeType       = 'px'
                } else {
                    percent                 += parseFloat(col.size)
                    this.columns[i].sizeType = '%'
                    delete col.sizeCorrected
                }
            }
            // if sum != 100% -- reassign proportionally
            if (percent != 100 && percent > 0) {
                for (let i = 0; i < this.columns.length; i++) {
                    let col = this.columns[i]
                    if (col.hidden) continue
                    if (col.sizeType == '%') {
                        col.sizeCorrected = Math.round(parseFloat(col.size) * 100 * 100 / percent) / 100 + '%'
                    }
                }
            }
            // calculate % columns
            for (let i = 0; i < this.columns.length; i++) {
                let col = this.columns[i]
                if (col.hidden) continue
                if (col.sizeType == '%') {
                    if (this.columns[i].sizeCorrected != null) {
                        // make it 1px smaller, so margin of error can be calculated correctly
                        this.columns[i].sizeCalculated = Math.floor(width_max * parseFloat(col.sizeCorrected) / 100) - 1 + 'px'
                    } else {
                        // make it 1px smaller, so margin of error can be calculated correctly
                        this.columns[i].sizeCalculated = Math.floor(width_max * parseFloat(col.size) / 100) - 1 + 'px'
                    }
                }
            }
        }
        // fix margin of error that is due percentage calculations
        let width_cols = 0
        for (let i = 0; i < this.columns.length; i++) {
            let col = this.columns[i]
            if (col.hidden) continue
            if (col.min == null) col.min = 20
            if (parseInt(col.sizeCalculated) < parseInt(col.min)) col.sizeCalculated = col.min + 'px'
            if (parseInt(col.sizeCalculated) > parseInt(col.max)) col.sizeCalculated = col.max + 'px'
            width_cols += parseInt(col.sizeCalculated)
        }
        let width_diff = parseInt(width_box) - parseInt(width_cols)
        if (width_diff > 0 && percent > 0) {
            let i = 0
            while (true) {
                let col = this.columns[i]
                if (col == null) { i = 0; continue }
                if (col.hidden || col.sizeType == 'px') { i++; continue }
                col.sizeCalculated = (parseInt(col.sizeCalculated) + 1) + 'px'
                width_diff--
                if (width_diff === 0) break
                i++
            }
        } else if (width_diff > 0) {
            columns.find('> table > tbody > tr:nth-child(1) td.w2ui-head-last').css('width', w2utils.scrollBarSize()).show()
        }
        // find width of frozen columns
        let fwidth = 1
        if (this.show.lineNumbers) fwidth += lineNumberWidth
        if (this.show.selectColumn) fwidth += 26
        // if (this.show.orderColumn) fwidth += 26;
        if (this.show.expandColumn) fwidth += 26
        for (let i = 0; i < this.columns.length; i++) {
            if (this.columns[i].hidden) continue
            if (this.columns[i].frozen) fwidth += parseInt(this.columns[i].sizeCalculated)
        }
        fcolumns.css('width', fwidth)
        frecords.css('width', fwidth)
        fsummary.css('width', fwidth)
        scroll1.css('width', fwidth)
        columns.css('left', fwidth)
        records.css('left', fwidth)
        summary.css('left', fwidth)
        // resize columns
        columns.find('> table > tbody > tr:nth-child(1) td')
            .add(fcolumns.find('> table > tbody > tr:nth-child(1) td'))
            .each((index, el) => {
                // line numbers
                if ($(el).hasClass('w2ui-col-number')) {
                    $(el).css('width', lineNumberWidth)
                }
                // records
                let ind = $(el).attr('col')
                if (ind != null) {
                    if (ind == 'start') {
                        let width = 0
                        for (let i = 0; i < obj.last.colStart; i++) {
                            if (!obj.columns[i] || obj.columns[i].frozen || obj.columns[i].hidden) continue
                            width += parseInt(obj.columns[i].sizeCalculated)
                        }
                        $(el).css('width', width + 'px')
                    }
                    if (obj.columns[ind]) $(el).css('width', obj.columns[ind].sizeCalculated)
                }
                // last column
                if ($(el).hasClass('w2ui-head-last')) {
                    if (obj.last.colEnd + 1 < obj.columns.length) {
                        let width = 0
                        for (let i = obj.last.colEnd + 1; i < obj.columns.length; i++) {
                            if (!obj.columns[i] || obj.columns[i].frozen || obj.columns[i].hidden) continue
                            width += parseInt(obj.columns[i].sizeCalculated)
                        }
                        $(el).css('width', width + 'px')
                    } else {
                        $(el).css('width', w2utils.scrollBarSize() + (width_diff > 0 && percent === 0 ? width_diff : 0) + 'px')
                    }
                }
            })
        // if there are column groups - hide first row (needed for sizing)
        if (columns.find('> table > tbody > tr').length == 3) {
            columns.find('> table > tbody > tr:nth-child(1) td')
                .add(fcolumns.find('> table > tbody > tr:nth-child(1) td'))
                .html('').css({
                    'height' : '0px',
                    'border' : '0px',
                    'padding': '0px',
                    'margin' : '0px'
                })
        }
        // resize records
        records.find('> table > tbody > tr:nth-child(1) td')
            .add(frecords.find('> table > tbody > tr:nth-child(1) td'))
            .each((index, el) =>{
                // line numbers
                if ($(el).hasClass('w2ui-col-number')) {
                    $(el).css('width', lineNumberWidth)
                }
                // records
                let ind = $(el).attr('col')
                if (ind != null) {
                    if (ind == 'start') {
                        let width = 0
                        for (let i = 0; i < obj.last.colStart; i++) {
                            if (!obj.columns[i] || obj.columns[i].frozen || obj.columns[i].hidden) continue
                            width += parseInt(obj.columns[i].sizeCalculated)
                        }
                        $(el).css('width', width + 'px')
                    }
                    if (obj.columns[ind]) $(el).css('width', obj.columns[ind].sizeCalculated)
                }
                // last column
                if ($(el).hasClass('w2ui-grid-data-last') && $(el).parents('.w2ui-grid-frecords').length === 0) { // not in frecords
                    if (obj.last.colEnd + 1 < obj.columns.length) {
                        let width = 0
                        for (let i = obj.last.colEnd + 1; i < obj.columns.length; i++) {
                            if (!obj.columns[i] || obj.columns[i].frozen || obj.columns[i].hidden) continue
                            width += parseInt(obj.columns[i].sizeCalculated)
                        }
                        $(el).css('width', width + 'px')
                    } else {
                        $(el).css('width', (width_diff > 0 && percent === 0 ? width_diff : 0) + 'px')
                    }
                }
            })
        // resize summary
        summary.find('> table > tbody > tr:nth-child(1) td')
            .add(fsummary.find('> table > tbody > tr:nth-child(1) td'))
            .each((index, el) => {
                // line numbers
                if ($(el).hasClass('w2ui-col-number')) {
                    $(el).css('width', lineNumberWidth)
                }
                // records
                let ind = $(el).attr('col')
                if (ind != null) {
                    if (ind == 'start') {
                        let width = 0
                        for (let i = 0; i < obj.last.colStart; i++) {
                            if (!obj.columns[i] || obj.columns[i].frozen || obj.columns[i].hidden) continue
                            width += parseInt(obj.columns[i].sizeCalculated)
                        }
                        $(el).css('width', width + 'px')
                    }
                    if (obj.columns[ind]) $(el).css('width', obj.columns[ind].sizeCalculated)
                }
                // last column
                if ($(el).hasClass('w2ui-grid-data-last') && $(el).parents('.w2ui-grid-frecords').length === 0) { // not in frecords
                    $(el).css('width', w2utils.scrollBarSize() + (width_diff > 0 && percent === 0 ? width_diff : 0) + 'px')
                }
            })
        this.initResize()
        this.refreshRanges()
        // apply last scroll if any
        if ((this.last.scrollTop || this.last.scrollLeft) && records.length > 0) {
            columns.prop('scrollLeft', this.last.scrollLeft)
            records.prop('scrollTop', this.last.scrollTop)
            records.prop('scrollLeft', this.last.scrollLeft)
        }
    }
    getSearchesHTML() {
        let html = `
            <div class="search-title">
                ${w2utils.lang('Advanced Search')}
                <span class="search-logic" style="${this.show.searchLogic ? '' : 'display: none'}">
                    <select id="grid_${this.name}_logic" class="w2ui-input">
                        <option value="AND" ${this.last.logic == 'AND' ? 'selected' : ''}>${w2utils.lang('All')}</option>
                        <option value="OR" ${this.last.logic == 'OR' ? 'selected' : ''}>${w2utils.lang('Any')}</option>
                    </select>
                </span>
            </div>
            <table cellspacing="0"><tbody>
        `
        for (let i = 0; i < this.searches.length; i++) {
            let s  = this.searches[i]
            s.type = String(s.type).toLowerCase()
            if (s.hidden) continue
            if (s.inTag == null) s.inTag = ''
            if (s.outTag == null) s.outTag = ''
            if (s.style == null) s.style = ''
            if (s.type == null) s.type = 'text'
            if (s.label == null && s.caption != null) {
                console.log('NOTICE: grid search.caption property is deprecated, please use search.label. Search ->', s)
                s.label = s.caption
            }
            let operator =`<select id="grid_${this.name}_operator_${i}" class="w2ui-input" data-change="initOperator|${i}">
                    ${this.getOperators(s.type, s.operators)}
                </select>`
            html += `<tr>
                        <td class="caption">${(w2utils.lang(s.label) || '')}</td>
                        <td class="operator">${operator}</td>
                        <td class="value">`
            let tmpStyle
            switch (s.type) {
                case 'text':
                case 'alphanumeric':
                case 'hex':
                case 'color':
                case 'list':
                case 'combo':
                case 'enum':
                    tmpStyle = 'width: 250px;'
                    if (['hex', 'color'].indexOf(s.type) != -1) tmpStyle = 'width: 90px;'
                    html += `<input rel="search" type="text" id="grid_${this.name}_field_${i}" name="${s.field}"
                               class="w2ui-input" style="${tmpStyle + s.style}" ${s.inTag}>`
                    break
                case 'int':
                case 'float':
                case 'money':
                case 'currency':
                case 'percent':
                case 'date':
                case 'time':
                case 'datetime':
                    tmpStyle = 'width: 90px;'
                    if (s.type == 'datetime') tmpStyle = 'width: 140px;'
                    html += `<input id="grid_${this.name}_field_${i}" name="${s.field}" ${s.inTag} rel="search" type="text"
                                class="w2ui-input" style="${tmpStyle + s.style}">
                            <span id="grid_${this.name}_range_${i}" style="display: none">&#160;-&#160;&#160;
                                <input rel="search" type="text" class="w2ui-input" style="${tmpStyle + s.style}" id="grid_${this.name}_field2_${i}" name="${s.field}" ${s.inTag}>
                            </span>`
                    break
                case 'select':
                    html += `<select rel="search" class="w2ui-input" style="${s.style}" id="grid_${this.name}_field_${i}"
                                name="${s.field}" ${s.inTag}></select>`
                    break
            }
            html += s.outTag +
                    '    </td>' +
                    '</tr>'
        }
        html += `<tr>
            <td colspan="2" class="actions">
                <button type="button" class="w2ui-btn close-btn" data-click="searchClose">${w2utils.lang('Close')}</button>
            </td>
            <td class="actions">
                <button type="button" class="w2ui-btn" data-click="searchReset">${w2utils.lang('Reset')}</button>
                <button type="button" class="w2ui-btn w2ui-btn-blue" data-click="search">${w2utils.lang('Search')}</button>
            </td>
        </tr></tbody></table>`
        return html
    }
    getOperators(type, opers) {
        let operators = this.operators[this.operatorsMap[type]] || []
        if (opers != null && Array.isArray(opers)) {
            operators = opers
        }
        let html = ''
        operators.forEach(oper => {
            let text = oper
            if (Array.isArray(oper)) {
                text = oper[1]
                oper = oper[0]
                if (text == null) text = oper
            } else if ($.isPlainObject(oper)) {
                text = oper.text
                oper = oper.oper
            }
            html += `<option value="${oper}">${w2utils.lang(text)}</option>\n`
        })
        return html
    }
    initOperator(ind) {
        let options
        let search = this.searches[ind]
        let sdata  = this.getSearchData(search.field)
        let $rng   = $(this.box).find(`#grid_${this.name}_range_${ind}`)
        let $fld1  = $(this.box).find(`#grid_${this.name}_field_${ind}`)
        let $fld2  = $(this.box).find(`#grid_${this.name}_field2_${ind}`)
        let $oper  = $(this.box).find(`#grid_${this.name}_operator_${ind}`)
        let oper   = $oper.val()
        $fld1.show()
        $rng.hide()
        // init based on operator value
        switch (oper) {
            case 'between':
                $rng.show()
                if ($.fn.w2field) {
                    $fld2.w2field(search.type, search.options)
                }
                break
            case 'null':
            case 'not null':
                $fld1.hide()
                $fld1.val(oper) // need to insert something for search to activate
                $fld1.trigger('change')
                break
        }
        // init based on search type
        switch (search.type) {
            case 'text':
            case 'alphanumeric':
                if (oper == 'in' || oper == 'not in') {
                    let obj = $fld1.data('w2field')
                    if (!obj || obj.type == 'clear') {
                        $fld1.w2field('enum', search.options)
                        if (sdata && Array.isArray(sdata.value)) {
                            $fld1.data('selected', sdata.value)
                        }
                    }
                } else {
                    let sel = $fld1.data('selected')
                    $fld1.w2field('clear')
                    $fld1.removeData('w2field')
                    if (Array.isArray(sel) && sel.length > 0 && sel[0].text) {
                        $fld1.val(sel[0].text)
                    }
                }
                break
            case 'int':
            case 'float':
            case 'hex':
            case 'color':
            case 'money':
            case 'currency':
            case 'percent':
            case 'date':
            case 'time':
            case 'datetime':
                if ($.fn.w2field) {
                    $fld1.w2field(search.type, search.options)
                    $fld2.w2field(search.type, search.options)
                }
                setTimeout(() => { // convert to date if it is number
                    $fld1.keydown()
                    $fld2.keydown()
                }, 1)
                break
            case 'list':
            case 'combo':
            case 'enum':
                options = search.options
                if (search.type == 'list') options.selected = {}
                if (search.type == 'enum') options.selected = []
                if (sdata) options.selected = sdata.value
                if ($.fn.w2field) {
                    $fld1.w2field(search.type, $.extend({ openOnFocus: true }, options))
                }
                if (sdata && sdata.text != null) {
                    $fld1.data('selected', {id: sdata.value, text: sdata.text})
                }
                break
            case 'select':
                // build options
                options = '<option value="">--</option>'
                for (let i = 0; i < search.options.items.length; i++) {
                    let si = search.options.items[i]
                    if ($.isPlainObject(search.options.items[i])) {
                        let val = si.id
                        let txt = si.text
                        if (val == null && si.value != null) val = si.value
                        if (txt == null && si.text != null) txt = si.text
                        if (val == null) val = ''
                        options += '<option value="'+ val +'">'+ txt +'</option>'
                    } else {
                        options += '<option value="'+ si +'">'+ si +'</option>'
                    }
                }
                $fld1.html(options)
                break
        }
    }
    initSearches() {
        let obj = this
        // init searches
        for (let ind = 0; ind < this.searches.length; ind++) {
            let search  = this.searches[ind]
            let sdata   = this.getSearchData(search.field)
            search.type = String(search.type).toLowerCase()
            if (typeof search.options != 'object') search.options = {}
            // operators
            let operator  = search.operator
            let operators = this.operators[this.operatorsMap[search.type]] || []
            if (search.operators) operators = search.operators
            // normalize
            if ($.isPlainObject(operator)) operator = operator.oper
            operators.forEach((oper, ind) => {
                if ($.isPlainObject(oper)) operators[ind] = oper.oper
            })
            if (sdata && sdata.operator) {
                operator = sdata.operator
            }
            // default operator
            let def = this.defaultOperator[this.operatorsMap[search.type]]
            if (operators.indexOf(operator) == -1) {
                operator = def
            }
            $(this.box).find(`#grid_${this.name}_operator_${ind}`).val(operator)
            this.initOperator(ind)
            // populate field value
            let $fld1 = $(this.box).find(`#grid_${this.name}_field_${ind}`)
            let $fld2 = $(this.box).find(`#grid_${this.name}_field2_${ind}`)
            if (sdata != null) {
                if (sdata.type == 'int' && ['in', 'not in'].indexOf(sdata.operator) != -1) {
                    $fld1.w2field('clear').val(sdata.value)
                }
                if (!Array.isArray(sdata.value)) {
                    if (sdata.value != null) $fld1.val(sdata.value).trigger('change')
                } else {
                    if (['in', 'not in'].indexOf(sdata.operator) != -1) {
                        $fld1.val(sdata.value).trigger('change')
                    } else {
                        $fld1.val(sdata.value[0]).trigger('change')
                        $fld2.val(sdata.value[1]).trigger('change')
                    }
                }
            }
        }
        // add on change event
        $(this.box).find(`#w2overlay-${this.name}-search-overlay .w2ui-grid-search-advanced *[rel=search]`)
            .on('keypress', function(evnt) {
                if (evnt.keyCode == 13) {
                    obj.search()
                    w2tooltip.hide(obj.name + '-search-overlay')
                }
            })
    }
    getColumnsHTML() {
        let obj   = this
        let html1 = ''
        let html2 = ''
        if (this.show.columnHeaders) {
            if (this.columnGroups.length > 0) {
                let tmp1 = getColumns(true)
                let tmp2 = getGroups()
                let tmp3 = getColumns(false)
                html1    = tmp1[0] + tmp2[0] + tmp3[0]
                html2    = tmp1[1] + tmp2[1] + tmp3[1]
            } else {
                let tmp = getColumns(true)
                html1   = tmp[0]
                html2   = tmp[1]
            }
        }
        return [html1, html2]
        function getGroups () {
            let html1 = '<tr>'
            let html2 = '<tr>'
            let tmpf  = ''
            // add empty group at the end
            let tmp = obj.columnGroups.length - 1
            if (obj.columnGroups[tmp].text == null && obj.columnGroups[tmp].caption != null) {
                console.log('NOTICE: grid columnGroup.caption property is deprecated, please use columnGroup.text. Group -> ', obj.columnGroups[tmp])
                obj.columnGroups[tmp].text = obj.columnGroups[tmp].caption
            }
            if (obj.columnGroups[obj.columnGroups.length-1].text != '') obj.columnGroups.push({ text: '' })
            if (obj.show.lineNumbers) {
                html1 += '<td class="w2ui-head w2ui-col-number">'+
                        '    <div>&#160;</div>'+
                        '</td>'
            }
            if (obj.show.selectColumn) {
                html1 += '<td class="w2ui-head w2ui-col-select">'+
                        '    <div style="height: 25px">&#160;</div>'+
                        '</td>'
            }
            if (obj.show.expandColumn) {
                html1 += '<td class="w2ui-head w2ui-col-expand">'+
                        '    <div style="height: 25px">&#160;</div>'+
                        '</td>'
            }
            let ii = 0
            html2 += '<td id="grid_'+ obj.name + '_column_start" class="w2ui-head" col="start" style="border-right: 0"></td>'
            if (obj.show.orderColumn) {
                html2 += '<td class="w2ui-head w2ui-col-order" col="order">'+
                        '    <div style="height: 25px">&#160;</div>'+
                        '</td>'
            }
            for (let i = 0; i<obj.columnGroups.length; i++) {
                let colg = obj.columnGroups[i]
                let col  = obj.columns[ii] || {}
                if (colg.colspan != null) colg.span = colg.colspan
                if (colg.span == null || colg.span != parseInt(colg.span)) colg.span = 1
                if (col.text == null && col.caption != null) {
                    console.log('NOTICE: grid column.caption property is deprecated, please use column.text. Column ->', col)
                    col.text = col.caption
                }
                let colspan = 0
                for (let jj = ii; jj < ii + colg.span; jj++) {
                    if (obj.columns[jj] && !obj.columns[jj].hidden) {
                        colspan++
                    }
                }
                if (i == obj.columnGroups.length-1) {
                    colspan = 100 // last column
                }
                if (colspan <= 0) {
                    // do nothing here, all columns in the group are hidden.
                } else if (colg.main === true) {
                    let sortStyle = ''
                    for (let si = 0; si < obj.sortData.length; si++) {
                        if (obj.sortData[si].field == col.field) {
                            if ((obj.sortData[si].direction || '').toLowerCase() === 'asc') sortStyle = 'w2ui-sort-up'
                            if ((obj.sortData[si].direction || '').toLowerCase() === 'desc') sortStyle = 'w2ui-sort-down'
                        }
                    }
                    let resizer = ''
                    if (col.resizable !== false) {
                        resizer = '<div class="w2ui-resizer" name="'+ ii +'"></div>'
                    }
                    let text = w2utils.lang(typeof col.text == 'function' ? col.text(col) : col.text)
                    tmpf     = '<td id="grid_'+ obj.name + '_column_' + ii +'" class="w2ui-head '+ sortStyle +'" col="'+ ii + '" '+
                           '    rowspan="2" colspan="'+ colspan +'" '+
                           '    oncontextmenu = "w2ui[\''+ obj.name +'\'].contextMenu(null, '+ ii +', event);"'+
                           '    onclick="w2ui[\''+ obj.name +'\'].columnClick(\''+ col.field +'\', event);"'+
                           '    ondblclick="w2ui[\''+ obj.name +'\'].columnDblClick(\''+ col.field +'\', event);">'+
                               resizer +
                           '    <div class="w2ui-col-group w2ui-col-header '+ (sortStyle ? 'w2ui-col-sorted' : '') +'">'+
                           '        <div class="'+ sortStyle +'"></div>'+
                                   (!text ? '&#160;' : text) +
                           '    </div>'+
                           '</td>'
                    if (col && col.frozen) html1 += tmpf; else html2 += tmpf
                } else {
                    let gText = w2utils.lang(typeof colg.text == 'function' ? colg.text(colg) : colg.text)
                    tmpf      = '<td id="grid_'+ obj.name + '_column_' + ii +'" class="w2ui-head" col="'+ ii + '" '+
                           '        colspan="'+ colspan +'">'+
                           '    <div class="w2ui-col-group">'+
                               (!gText ? '&#160;' : gText) +
                           '    </div>'+
                           '</td>'
                    if (col && col.frozen) html1 += tmpf; else html2 += tmpf
                }
                ii += colg.span
            }
            html1 += '<td></td></tr>' // need empty column for border-right
            html2 += '<td id="grid_'+ obj.name + '_column_end" class="w2ui-head" col="end"></td></tr>'
            return [html1, html2]
        }
        function getColumns (main) {
            let html1 = '<tr>'
            let html2 = '<tr>'
            if (obj.show.lineNumbers) {
                html1 += '<td class="w2ui-head w2ui-col-number" '+
                        '       onclick="w2ui[\''+ obj.name +'\'].columnClick(\'line-number\', event);"'+
                        '       ondblclick="w2ui[\''+ obj.name +'\'].columnDblClick(\'line-number\', event);">'+
                        '    <div>#</div>'+
                        '</td>'
            }
            if (obj.show.selectColumn) {
                html1 += '<td class="w2ui-head w2ui-col-select"'+
                        '       onclick="if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;">'+
                        '    <div>'+
                        '        <input type="checkbox" id="grid_'+ obj.name +'_check_all" tabindex="-1"'+
                        '            style="' + (obj.multiSelect == false ? 'display: none;' : '') + '"'+
                        '            onmousedown="if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;"'+
                        '            onclick="let grid = w2ui[\''+ obj.name +'\'];'+
                        '               if (this.checked) grid.selectAll(); else grid.selectNone();'+
                        '               if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;'+
                        '               clearTimeout(grid.last.kbd_timer); /* keep focus */' +
                        '            "/>'+
                        '    </div>'+
                        '</td>'
            }
            if (obj.show.expandColumn) {
                html1 += '<td class="w2ui-head w2ui-col-expand">'+
                        '    <div>&#160;</div>'+
                        '</td>'
            }
            let ii = 0
            let id = 0
            let colg
            html2 += '<td id="grid_'+ obj.name + '_column_start" class="w2ui-head" col="start" style="border-right: 0"></td>'
            if (obj.show.orderColumn) {
                html2 += '<td class="w2ui-head w2ui-col-order" col="order">'+
                        '    <div>&#160;</div>'+
                        '</td>'
            }
            for (let i = 0; i < obj.columns.length; i++) {
                let col = obj.columns[i]
                if (col.text == null && col.caption != null) {
                    console.log('NOTICE: grid column.caption property is deprecated, please use column.text. Column -> ', col)
                    col.text = col.caption
                }
                if (col.size == null) col.size = '100%'
                if (i == id) { // always true on first iteration
                    colg = obj.columnGroups[ii++] || {}
                    id   = id + colg.span
                }
                if ((i < obj.last.colStart || i > obj.last.colEnd) && !col.frozen)
                    continue
                if (col.hidden)
                    continue
                if (colg.main !== true || main) { // grouping of columns
                    let colCellHTML = obj.getColumnCellHTML(i)
                    if (col && col.frozen) html1 += colCellHTML; else html2 += colCellHTML
                }
            }
            html1 += '<td class="w2ui-head w2ui-head-last"><div>&#160;</div></td>'
            html2 += '<td class="w2ui-head w2ui-head-last" col="end"><div>&#160;</div></td>'
            html1 += '</tr>'
            html2 += '</tr>'
            return [html1, html2]
        }
    }
    getColumnCellHTML(i) {
        let col = this.columns[i]
        if (col == null) return ''
        // reorder style
        let reorderCols = (this.reorderColumns && (!this.columnGroups || !this.columnGroups.length)) ? ' w2ui-reorder-cols-head ' : ''
        // sort style
        let sortStyle = ''
        for (let si = 0; si < this.sortData.length; si++) {
            if (this.sortData[si].field == col.field) {
                if ((this.sortData[si].direction || '').toLowerCase() === 'asc') sortStyle = 'w2ui-sort-up'
                if ((this.sortData[si].direction || '').toLowerCase() === 'desc') sortStyle = 'w2ui-sort-down'
            }
        }
        // col selected
        let tmp      = this.last.selection.columns
        let selected = false
        for (let t in tmp) {
            for (let si = 0; si < tmp[t].length; si++) {
                if (tmp[t][si] == i) selected = true
            }
        }
        let text = w2utils.lang(typeof col.text == 'function' ? col.text(col) : col.text)
        let tooltip = w2utils.lang(typeof col.tooltip == 'function' ? col.tooltip(col) : col.tooltip)
        let html = '<td id="grid_'+ this.name + '_column_' + i +'" col="'+ i +'" class="w2ui-head '+ sortStyle + reorderCols + '" ' +
                    '    onmouseEnter = "w2ui[\''+ this.name +'\'].columnTooltipShow(\''+ i +'\', event);"'+
                    '    onmouseLeave  = "w2ui[\''+ this.name +'\'].columnTooltipHide(\''+ i +'\', event);"'+
                    '    oncontextmenu = "w2ui[\''+ this.name +'\'].contextMenu(null, '+ i +', event);"'+
                    '    onclick="w2ui[\''+ this.name +'\'].columnClick(\''+ col.field +'\', event);"'+
                    '    ondblclick="w2ui[\''+ this.name +'\'].columnDblClick(\''+ col.field +'\', event);">'+
                         (col.resizable !== false ? '<div class="w2ui-resizer" name="'+ i +'"></div>' : '') +
                    '    <div class="w2ui-col-header '+ (sortStyle ? 'w2ui-col-sorted' : '') +' '+ (selected ? 'w2ui-col-selected' : '') +'">'+
                    '        <div class="'+ sortStyle +'"></div>'+
                            (!text ? '&#160;' : text) +
                    '    </div>'+
                    '</td>'
        return html
    }
    columnTooltipShow(ind, event) {
        let $el  = query(this.box).find('#grid_'+ this.name + '_column_'+ ind)
        let item = this.columns[ind]
        let pos  = this.columnTooltip
        w2tooltip.show({
            name: this.name + '-column-tooltip',
            anchor: $el.get(0),
            html: item.tooltip,
            position: pos,
        })
    }
    columnTooltipHide(ind, event) {
        w2tooltip.hide(this.name + '-column-tooltip')
    }
    getRecordsHTML() {
        let buffered = this.records.length
        let url      = (typeof this.url != 'object' ? this.url : this.url.get)
        if (this.searchData.length != 0 && !url) buffered = this.last.searchIds.length
        // larger number works better with chrome, smaller with FF.
        if (buffered > this.vs_start) this.last.show_extra = this.vs_extra; else this.last.show_extra = this.vs_start
        let records = $(this.box).find('#grid_'+ this.name +'_records')
        let limit   = Math.floor((records.height() || 0) / this.recordHeight) + this.last.show_extra + 1
        if (!this.fixedBody || limit > buffered) limit = buffered
        // always need first record for resizing purposes
        let rec_html = this.getRecordHTML(-1, 0)
        let html1    = '<table><tbody>' + rec_html[0]
        let html2    = '<table><tbody>' + rec_html[1]
        // first empty row with height
        html1 += '<tr id="grid_'+ this.name + '_frec_top" line="top" style="height: '+ 0 +'px">'+
                 '    <td colspan="2000"></td>'+
                 '</tr>'
        html2 += '<tr id="grid_'+ this.name + '_rec_top" line="top" style="height: '+ 0 +'px">'+
                 '    <td colspan="2000"></td>'+
                 '</tr>'
        for (let i = 0; i < limit; i++) {
            rec_html = this.getRecordHTML(i, i+1)
            html1   += rec_html[0]
            html2   += rec_html[1]
        }
        let h2 = (buffered - limit) * this.recordHeight
        html1 += '<tr id="grid_' + this.name + '_frec_bottom" rec="bottom" line="bottom" style="height: ' + h2 + 'px; vertical-align: top">' +
                '    <td colspan="2000" style="border-right: 1px solid #D6D5D7;"></td>'+
                '</tr>'+
                '<tr id="grid_'+ this.name +'_frec_more" style="display: none; ">'+
                '    <td colspan="2000" class="w2ui-load-more"></td>'+
                '</tr>'+
                '</tbody></table>'
        html2 += '<tr id="grid_' + this.name + '_rec_bottom" rec="bottom" line="bottom" style="height: ' + h2 + 'px; vertical-align: top">' +
                '    <td colspan="2000" style="border: 0"></td>'+
                '</tr>'+
                '<tr id="grid_'+ this.name +'_rec_more" style="display: none">'+
                '    <td colspan="2000" class="w2ui-load-more"></td>'+
                '</tr>'+
                '</tbody></table>'
        this.last.range_start = 0
        this.last.range_end   = limit
        return [html1, html2]
    }
    getSummaryHTML() {
        if (this.summary.length === 0) return
        let rec_html = this.getRecordHTML(-1, 0) // need this in summary too for colspan to work properly
        let html1    = '<table><tbody>' + rec_html[0]
        let html2    = '<table><tbody>' + rec_html[1]
        for (let i = 0; i < this.summary.length; i++) {
            rec_html = this.getRecordHTML(i, i+1, true)
            html1   += rec_html[0]
            html2   += rec_html[1]
        }
        html1 += '</tbody></table>'
        html2 += '</tbody></table>'
        return [html1, html2]
    }
    scroll(event) {
        let obj      = this
        let url      = (typeof this.url != 'object' ? this.url : this.url.get)
        let records  = $(this.box).find('#grid_'+ this.name +'_records')
        let frecords = $(this.box).find('#grid_'+ this.name +'_frecords')
        // sync scroll positions
        if (event) {
            let sTop                                         = event.target.scrollTop
            let sLeft                                        = event.target.scrollLeft
            this.last.scrollTop                              = sTop
            this.last.scrollLeft                             = sLeft
            $(this.box).find('#grid_'+ this.name +'_columns')[0].scrollLeft = sLeft
            $(this.box).find('#grid_'+ this.name +'_summary')[0].scrollLeft = sLeft
            frecords[0].scrollTop                            = sTop
        }
        // hide bubble
        if (this.last.bubbleEl) {
            w2tooltip.hide(this.name + '-bubble')
            this.last.bubbleEl = null
        }
        // column virtual scroll
        let colStart = null
        let colEnd   = null
        if (this.disableCVS || this.columnGroups.length > 0) {
            // disable virtual scroll
            colStart = 0
            colEnd   = this.columns.length - 1
        } else {
            let sWidth = records.width()
            let cLeft  = 0
            for (let i = 0; i < this.columns.length; i++) {
                if (this.columns[i].frozen || this.columns[i].hidden) continue
                let cSize = parseInt(this.columns[i].sizeCalculated ? this.columns[i].sizeCalculated : this.columns[i].size)
                if (cLeft + cSize + 30 > this.last.scrollLeft && colStart == null) colStart = i
                if (cLeft + cSize - 30 > this.last.scrollLeft + sWidth && colEnd == null) colEnd = i
                cLeft += cSize
            }
            if (colEnd == null) colEnd = this.columns.length - 1
        }
        if (colStart != null) {
            if (colStart < 0) colStart = 0
            if (colEnd < 0) colEnd = 0
            if (colStart == colEnd) {
                if (colStart > 0) colStart--; else colEnd++ // show at least one column
            }
            // ---------
            if (colStart != this.last.colStart || colEnd != this.last.colEnd) {
                let $box       = $(this.box)
                let deltaStart = Math.abs(colStart - this.last.colStart)
                let deltaEnd   = Math.abs(colEnd - this.last.colEnd)
                // add/remove columns for small jumps
                if (deltaStart < 5 && deltaEnd < 5) {
                    let $cfirst = $box.find('.w2ui-grid-columns #grid_'+ this.name +'_column_start')
                    let $clast  = $box.find('.w2ui-grid-columns .w2ui-head-last')
                    let $rfirst = $box.find('#grid_'+ this.name +'_records .w2ui-grid-data-spacer')
                    let $rlast  = $box.find('#grid_'+ this.name +'_records .w2ui-grid-data-last')
                    let $sfirst = $box.find('#grid_'+ this.name +'_summary .w2ui-grid-data-spacer')
                    let $slast  = $box.find('#grid_'+ this.name +'_summary .w2ui-grid-data-last')
                    // remove on left
                    if (colStart > this.last.colStart) {
                        for (let i = this.last.colStart; i < colStart; i++) {
                            $box.find('#grid_'+ this.name +'_columns #grid_'+ this.name +'_column_'+ i).remove() // column
                            $box.find('#grid_'+ this.name +'_records td[col="'+ i +'"]').remove() // record
                            $box.find('#grid_'+ this.name +'_summary td[col="'+ i +'"]').remove() // summary
                        }
                    }
                    // remove on right
                    if (colEnd < this.last.colEnd) {
                        for (let i = this.last.colEnd; i > colEnd; i--) {
                            $box.find('#grid_'+ this.name +'_columns #grid_'+ this.name +'_column_'+ i).remove() // column
                            $box.find('#grid_'+ this.name +'_records td[col="'+ i +'"]').remove() // record
                            $box.find('#grid_'+ this.name +'_summary td[col="'+ i +'"]').remove() // summary
                        }
                    }
                    // add on left
                    if (colStart < this.last.colStart) {
                        for (let i = this.last.colStart - 1; i >= colStart; i--) {
                            if (this.columns[i] && (this.columns[i].frozen || this.columns[i].hidden)) continue
                            $cfirst.after(this.getColumnCellHTML(i)) // column
                            // record
                            $rfirst.each((ind, el) => {
                                let index = $(el).parent().attr('index')
                                let td    = '<td class="w2ui-grid-data" col="'+ i +'" style="height: 0px"></td>' // width column
                                if (index != null) td = this.getCellHTML(parseInt(index), i, false)
                                $(el).after(td)
                            })
                            // summary
                            $sfirst.each((ind, el) => {
                                let index = $(el).parent().attr('index')
                                let td    = '<td class="w2ui-grid-data" col="'+ i +'" style="height: 0px"></td>' // width column
                                if (index != null) td = this.getCellHTML(parseInt(index), i, true)
                                $(el).after(td)
                            })
                        }
                    }
                    // add on right
                    if (colEnd > this.last.colEnd) {
                        for (let i = this.last.colEnd + 1; i <= colEnd; i++) {
                            if (this.columns[i] && (this.columns[i].frozen || this.columns[i].hidden)) continue
                            $clast.before(this.getColumnCellHTML(i)) // column
                            // record
                            $rlast.each((ind, el) => {
                                let index = $(el).parent().attr('index')
                                let td    = '<td class="w2ui-grid-data" col="'+ i +'" style="height: 0px"></td>' // width column
                                if (index != null) td = this.getCellHTML(parseInt(index), i, false)
                                $(el).before(td)
                            })
                            // summary
                            $slast.each((ind, el) => {
                                let index = $(el).parent().attr('index') || -1
                                let td    = this.getCellHTML(parseInt(index), i, true)
                                $(el).before(td)
                            })
                        }
                    }
                    this.last.colStart = colStart
                    this.last.colEnd   = colEnd
                    this.resizeRecords()
                } else {
                    this.last.colStart = colStart
                    this.last.colEnd   = colEnd
                    // dot not just call this.refresh();
                    let colHTML   = this.getColumnsHTML()
                    let recHTML   = this.getRecordsHTML()
                    let sumHTML   = this.getSummaryHTML()
                    let $columns  = $box.find('#grid_'+ this.name +'_columns')
                    let $records  = $box.find('#grid_'+ this.name +'_records')
                    let $frecords = $box.find('#grid_'+ this.name +'_frecords')
                    let $summary  = $box.find('#grid_'+ this.name +'_summary')
                    $columns.find('tbody').html(colHTML[1])
                    $frecords.html(recHTML[0])
                    $records.prepend(recHTML[1])
                    if (sumHTML != null) $summary.html(sumHTML[1])
                    // need timeout to clean up (otherwise scroll problem)
                    setTimeout(() => {
                        $records.find('> table').not('table:first-child').remove()
                        if ($summary[0]) $summary[0].scrollLeft = this.last.scrollLeft
                    }, 1)
                    this.resizeRecords()
                }
            }
        }
        // perform virtual scroll
        let buffered = this.records.length
        if (buffered > this.total && this.total !== -1) buffered = this.total
        if (this.searchData.length != 0 && !url) buffered = this.last.searchIds.length
        if (buffered === 0 || records.length === 0 || records.height() === 0) return
        if (buffered > this.vs_start) this.last.show_extra = this.vs_extra; else this.last.show_extra = this.vs_start
        // update footer
        let t1 = Math.round(records[0].scrollTop / this.recordHeight + 1)
        let t2 = t1 + (Math.round(records.height() / this.recordHeight) - 1)
        if (t1 > buffered) t1 = buffered
        if (t2 >= buffered - 1) t2 = buffered
        $(this.box).find('#grid_'+ this.name + '_footer .w2ui-footer-right').html(
            (this.show.statusRange
                ? w2utils.formatNumber(this.offset + t1) + '-' + w2utils.formatNumber(this.offset + t2) +
                    (this.total != -1 ? ' ' + w2utils.lang('of') + ' ' + w2utils.formatNumber(this.total) : '')
                    : '') +
            (url && this.show.statusBuffered ? ' ('+ w2utils.lang('buffered') + ' '+ w2utils.formatNumber(buffered) +
                    (this.offset > 0 ? ', skip ' + w2utils.formatNumber(this.offset) : '') + ')' : '')
        )
        // only for local data source, else no extra records loaded
        if (!url && (!this.fixedBody || (this.total != -1 && this.total <= this.vs_start))) return
        // regular processing
        let start = Math.floor(records[0].scrollTop / this.recordHeight) - this.last.show_extra
        let end   = start + Math.floor(records.height() / this.recordHeight) + this.last.show_extra * 2 + 1
        // let div  = start - this.last.range_start;
        if (start < 1) start = 1
        if (end > this.total && this.total != -1) end = this.total
        let tr1  = records.find('#grid_'+ this.name +'_rec_top')
        let tr2  = records.find('#grid_'+ this.name +'_rec_bottom')
        let tr1f = frecords.find('#grid_'+ this.name +'_frec_top')
        let tr2f = frecords.find('#grid_'+ this.name +'_frec_bottom')
        // if row is expanded
        if (String(tr1.next().prop('id')).indexOf('_expanded_row') != -1) {
            tr1.next().remove()
            tr1f.next().remove()
        }
        if (this.total > end && String(tr2.prev().prop('id')).indexOf('_expanded_row') != -1) {
            tr2.prev().remove()
            tr2f.prev().remove()
        }
        let first = parseInt(tr1.next().attr('line'))
        let last  = parseInt(tr2.prev().attr('line'))
        let tmp, tmp1, tmp2, rec_start, rec_html
        if (first < start || first == 1 || this.last.pull_refresh) { // scroll down
            if (end <= last + this.last.show_extra - 2 && end != this.total) return
            this.last.pull_refresh = false
            // remove from top
            while (true) {
                tmp1 = frecords.find('#grid_'+ this.name +'_frec_top').next()
                tmp2 = records.find('#grid_'+ this.name +'_rec_top').next()
                if (tmp2.attr('line') == 'bottom') break
                if (parseInt(tmp2.attr('line')) < start) {
                    tmp1.remove();
                    tmp2.remove()
                } else {
                    break
                }
            }
            // add at bottom
            tmp       = records.find('#grid_'+ this.name +'_rec_bottom').prev()
            rec_start = tmp.attr('line')
            if (rec_start == 'top') rec_start = start
            for (let i = parseInt(rec_start) + 1; i <= end; i++) {
                if (!this.records[i-1]) continue
                tmp2 = this.records[i-1].w2ui
                if (tmp2 && !Array.isArray(tmp2.children)) {
                    tmp2.expanded = false
                }
                rec_html = this.getRecordHTML(i-1, i)
                tr2.before(rec_html[1])
                tr2f.before(rec_html[0])
            }
            markSearch()
            setTimeout(() => { this.refreshRanges() }, 0)
        } else { // scroll up
            if (start >= first - this.last.show_extra + 2 && start > 1) return
            // remove from bottom
            while (true) {
                tmp1 = frecords.find('#grid_'+ this.name +'_frec_bottom').prev()
                tmp2 = records.find('#grid_'+ this.name +'_rec_bottom').prev()
                if (tmp2.attr('line') == 'top') break
                if (parseInt(tmp2.attr('line')) > end) {
                    tmp1.remove();
                    tmp2.remove()
                } else {
                    break
                }
            }
            // add at top
            tmp       = records.find('#grid_'+ this.name +'_rec_top').next()
            rec_start = tmp.attr('line')
            if (rec_start == 'bottom') rec_start = end
            for (let i = parseInt(rec_start) - 1; i >= start; i--) {
                if (!this.records[i-1]) continue
                tmp2 = this.records[i-1].w2ui
                if (tmp2 && !Array.isArray(tmp2.children)) {
                    tmp2.expanded = false
                }
                rec_html = this.getRecordHTML(i-1, i)
                tr1.after(rec_html[1])
                tr1f.after(rec_html[0])
            }
            markSearch()
            setTimeout(() => { this.refreshRanges() }, 0)
        }
        // first/last row size
        let h1 = (start - 1) * this.recordHeight
        let h2 = (buffered - end) * this.recordHeight
        if (h2 < 0) h2 = 0
        tr1.css('height', h1 + 'px')
        tr1f.css('height', h1 + 'px')
        tr2.css('height', h2 + 'px')
        tr2f.css('height', h2 + 'px')
        this.last.range_start = start
        this.last.range_end   = end
        // load more if needed
        let s = Math.floor(records[0].scrollTop / this.recordHeight)
        let e = s + Math.floor(records.height() / this.recordHeight)
        if (e + 10 > buffered && this.last.pull_more !== true && (buffered < this.total - this.offset || (this.total == -1 && this.last.xhr_hasMore))) {
            if (this.autoLoad === true) {
                this.last.pull_more   = true
                this.last.xhr_offset += this.limit
                this.request('get')
            }
            // scroll function
            let more = $(this.box).find('#grid_'+ this.name +'_rec_more, #grid_'+ this.name +'_frec_more')
            more.show()
                .eq(1) // only main table
                .off('.load-more')
                .on('click.load-more', function() {
                    // show spinner
                    $(this).find('td').html('<div><div style="width: 20px; height: 20px;" class="w2ui-spinner"></div></div>')
                    // load more
                    obj.last.pull_more   = true
                    obj.last.xhr_offset += obj.limit
                    obj.request('get')
                })
                .find('td')
                .html(obj.autoLoad
                    ? '<div><div style="width: 20px; height: 20px;" class="w2ui-spinner"></div></div>'
                    : '<div style="padding-top: 15px">'+ w2utils.lang('Load ${count} more...', {count: obj.limit}) + '</div>'
                )
        }
        function markSearch() {
            // mark search
            if (!obj.markSearch) return
            clearTimeout(obj.last.marker_timer)
            obj.last.marker_timer = setTimeout(() => {
                // mark all search strings
                let search = []
                for (let s = 0; s < obj.searchData.length; s++) {
                    let sdata = obj.searchData[s]
                    let fld   = obj.getSearch(sdata.field)
                    if (!fld || fld.hidden) continue
                    let ind = obj.getColumn(sdata.field, true)
                    search.push({ field: sdata.field, search: sdata.value, col: ind })
                }
                if (search.length > 0) {
                    search.forEach((item) => {
                        $(obj.box).find('td[col="'+ item.col +'"]').not('.w2ui-head').w2marker(item.search)
                    })
                }
            }, 50)
        }
    }
    getRecordHTML(ind, lineNum, summary) {
        let tmph      = ''
        let rec_html1 = ''
        let rec_html2 = ''
        let sel       = this.last.selection
        let record
        // first record needs for resize purposes
        if (ind == -1) {
            rec_html1 += '<tr line="0">'
            rec_html2 += '<tr line="0">'
            if (this.show.lineNumbers) rec_html1 += '<td class="w2ui-col-number" style="height: 0px;"></td>'
            if (this.show.selectColumn) rec_html1 += '<td class="w2ui-col-select" style="height: 0px;"></td>'
            if (this.show.expandColumn) rec_html1 += '<td class="w2ui-col-expand" style="height: 0px;"></td>'
            rec_html2 += '<td class="w2ui-grid-data w2ui-grid-data-spacer" col="start" style="height: 0px; width: 0px;"></td>'
            if (this.show.orderColumn) rec_html2 += '<td class="w2ui-col-order" style="height: 0px;" col="order"></td>'
            for (let i = 0; i < this.columns.length; i++) {
                let col = this.columns[i]
                tmph    = '<td class="w2ui-grid-data" col="'+ i +'" style="height: 0px;"></td>'
                if (col.frozen && !col.hidden) {
                    rec_html1 += tmph
                } else {
                    if (col.hidden || i < this.last.colStart || i > this.last.colEnd) continue
                    rec_html2 += tmph
                }
            }
            rec_html1 += '<td class="w2ui-grid-data-last" style="height: 0px"></td>'
            rec_html2 += '<td class="w2ui-grid-data-last" col="end" style="height: 0px"></td>'
            rec_html1 += '</tr>'
            rec_html2 += '</tr>'
            return [rec_html1, rec_html2]
        }
        // regular record
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if (summary !== true) {
            if (this.searchData.length > 0 && !url) {
                if (ind >= this.last.searchIds.length) return ''
                ind    = this.last.searchIds[ind]
                record = this.records[ind]
            } else {
                if (ind >= this.records.length) return ''
                record = this.records[ind]
            }
        } else {
            if (ind >= this.summary.length) return ''
            record = this.summary[ind]
        }
        if (!record) return ''
        if (record.recid == null && this.recid != null) {
            let rid = this.parseField(record, this.recid)
            if (rid != null) record.recid = rid
        }
        let isRowSelected = false
        if (sel.indexes.indexOf(ind) != -1) isRowSelected = true
        let rec_style = (record.w2ui ? record.w2ui.style : '')
        if (rec_style == null || typeof rec_style != 'string') rec_style = ''
        let rec_class = (record.w2ui ? record.w2ui.class : '')
        if (rec_class == null || typeof rec_class != 'string') rec_class = ''
        // render TR
        rec_html1 += '<tr id="grid_'+ this.name +'_frec_'+ record.recid +'" recid="'+ record.recid +'" line="'+ lineNum +'" index="'+ ind +'" '+
            ' class="'+ (lineNum % 2 === 0 ? 'w2ui-even' : 'w2ui-odd') + ' w2ui-record ' + rec_class +
                (isRowSelected && this.selectType == 'row' ? ' w2ui-selected' : '') +
                (record.w2ui && record.w2ui.editable === false ? ' w2ui-no-edit' : '') +
                (record.w2ui && record.w2ui.expanded === true ? ' w2ui-expanded' : '') + '" ' +
            ' style="height: '+ this.recordHeight +'px; '+ (!isRowSelected && rec_style != '' ? rec_style : rec_style.replace('background-color', 'none')) +'" '+
                (rec_style != '' ? 'custom_style="'+ rec_style +'"' : '') +
            '>'
        rec_html2 += '<tr id="grid_'+ this.name +'_rec_'+ record.recid +'" recid="'+ record.recid +'" line="'+ lineNum +'" index="'+ ind +'" '+
            ' class="'+ (lineNum % 2 === 0 ? 'w2ui-even' : 'w2ui-odd') + ' w2ui-record ' + rec_class +
                (isRowSelected && this.selectType == 'row' ? ' w2ui-selected' : '') +
                (record.w2ui && record.w2ui.editable === false ? ' w2ui-no-edit' : '') +
                (record.w2ui && record.w2ui.expanded === true ? ' w2ui-expanded' : '') + '" ' +
            ' style="height: '+ this.recordHeight +'px; '+ (!isRowSelected && rec_style != '' ? rec_style : rec_style.replace('background-color', 'none')) +'" '+
                (rec_style != '' ? 'custom_style="'+ rec_style +'"' : '') +
            '>'
        if (this.show.lineNumbers) {
            rec_html1 += '<td id="grid_'+ this.name +'_cell_'+ ind +'_number' + (summary ? '_s' : '') + '" '+
                        '   class="w2ui-col-number '+ (isRowSelected ? ' w2ui-row-selected' : '') +'"'+
                            (this.reorderRows ? ' style="cursor: move"' : '') + '>'+
                            (summary !== true ? this.getLineHTML(lineNum, record) : '') +
                        '</td>'
        }
        if (this.show.selectColumn) {
            rec_html1 +=
                    '<td id="grid_'+ this.name +'_cell_'+ ind +'_select' + (summary ? '_s' : '') + '" class="w2ui-grid-data w2ui-col-select">'+
                        (summary !== true && !(record.w2ui && record.w2ui.hideCheckBox === true) ?
                        '    <div>'+
                        '        <input class="w2ui-grid-select-check" type="checkbox" tabindex="-1" '+
                                    (isRowSelected ? 'checked="checked"' : '') + ' style="pointer-events: none"/>'+
                        '    </div>'
                        :
                        '' ) +
                    '</td>'
        }
        if (this.show.expandColumn) {
            let tmp_img = ''
            if (record.w2ui && record.w2ui.expanded === true) tmp_img = '-'; else tmp_img = '+'
            if (record.w2ui && (record.w2ui.expanded == 'none' || !Array.isArray(record.w2ui.children) || !record.w2ui.children.length)) tmp_img = ''
            if (record.w2ui && record.w2ui.expanded == 'spinner') tmp_img = '<div class="w2ui-spinner" style="width: 16px; margin: -2px 2px;"></div>'
            rec_html1 +=
                    '<td id="grid_'+ this.name +'_cell_'+ ind +'_expand' + (summary ? '_s' : '') + '" class="w2ui-grid-data w2ui-col-expand">'+
                        (summary !== true ?
                        '    <div ondblclick="if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;" '+
                        '            onclick="w2ui[\''+ this.name +'\'].toggle(jQuery(this).parents(\'tr\').attr(\'recid\')); '+
                        '                if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true;">'+
                        '        '+ tmp_img +' </div>'
                        :
                        '' ) +
                    '</td>'
        }
        // insert empty first column
        rec_html2 += '<td class="w2ui-grid-data-spacer" col="start" style="border-right: 0"></td>'
        if (this.show.orderColumn) {
            rec_html2 +=
                    '<td id="grid_'+ this.name +'_cell_'+ ind +'_order' + (summary ? '_s' : '') + '" class="w2ui-grid-data w2ui-col-order" col="order">'+
                        (summary !== true ? '<div title="Drag to reorder">&nbsp;</div>' : '' ) +
                    '</td>'
        }
        let col_ind  = 0
        let col_skip = 0
        while (true) {
            let col_span = 1
            let col      = this.columns[col_ind]
            if (col == null) break
            if (col.hidden) {
                col_ind++
                if (col_skip > 0) col_skip--
                continue
            }
            if (col_skip > 0) {
                col_ind++
                if (this.columns[col_ind] == null) break
                record.w2ui.colspan[this.columns[col_ind-1].field] = 0 // need it for other methods
                col_skip--
                continue
            } else if (record.w2ui) {
                let tmp1 = record.w2ui.colspan
                let tmp2 = this.columns[col_ind].field
                if (tmp1 && tmp1[tmp2] === 0) {
                    delete tmp1[tmp2] // if no longer colspan then remove 0
                }
            }
            // column virtual scroll
            if ((col_ind < this.last.colStart || col_ind > this.last.colEnd) && !col.frozen) {
                col_ind++
                continue
            }
            if (record.w2ui) {
                if (typeof record.w2ui.colspan == 'object') {
                    let span = parseInt(record.w2ui.colspan[col.field]) || null
                    if (span > 1) {
                        // if there are hidden columns, then no colspan on them
                        let hcnt = 0
                        for (let i = col_ind; i < col_ind + span; i++) {
                            if (i >= this.columns.length) break
                            if (this.columns[i].hidden) hcnt++
                        }
                        col_span = span - hcnt
                        col_skip = span - 1
                    }
                }
            }
            let rec_cell = this.getCellHTML(ind, col_ind, summary, col_span)
            if (col.frozen) rec_html1 += rec_cell; else rec_html2 += rec_cell
            col_ind++
        }
        rec_html1 += '<td class="w2ui-grid-data-last"></td>'
        rec_html2 += '<td class="w2ui-grid-data-last" col="end"></td>'
        rec_html1 += '</tr>'
        rec_html2 += '</tr>'
        return [rec_html1, rec_html2]
    }
    getLineHTML(lineNum) {
        return '<div>' + lineNum + '</div>'
    }
    getCellHTML(ind, col_ind, summary, col_span) {
        let obj = this
        let col = this.columns[col_ind]
        if (col == null) return ''
        let record  = (summary !== true ? this.records[ind] : this.summary[ind])
        // value, attr, style, className, divAttr
        let { value, style, className, attr, divAttr } = this.getCellValue(ind, col_ind, summary, true)
        let edit = (ind !== -1 ? this.getCellEditable(ind, col_ind) : '')
        let divStyle = 'max-height: '+ parseInt(this.recordHeight) +'px;' + (col.clipboardCopy ? 'margin-right: 20px' : '')
        let isChanged = !summary && record && record.w2ui && record.w2ui.changes && record.w2ui.changes[col.field] != null
        let sel = this.last.selection
        let isRowSelected = false
        let infoBubble    = ''
        if (sel.indexes.indexOf(ind) != -1) isRowSelected = true
        if (col_span == null) {
            if (record && record.w2ui && record.w2ui.colspan && record.w2ui.colspan[col.field]) {
                col_span = record.w2ui.colspan[col.field]
            } else {
                col_span = 1
            }
        }
        // expand icon
        if (col_ind === 0 && record && record.w2ui && Array.isArray(record.w2ui.children)) {
            let level  = 0
            let subrec = this.get(record.w2ui.parent_recid, true)
            while (true) {
                if (subrec != null) {
                    level++
                    let tmp = this.records[subrec].w2ui
                    if (tmp != null && tmp.parent_recid != null) {
                        subrec = this.get(tmp.parent_recid, true)
                    } else {
                        break
                    }
                } else {
                    break
                }
            }
            if (record.w2ui.parent_recid){
                for (let i = 0; i < level; i++) {
                    infoBubble += '<span class="w2ui-show-children w2ui-icon-empty"></span>'
                }
            }
            infoBubble += '<span class="w2ui-show-children '+
                    (record.w2ui.children.length > 0
                        ? (record.w2ui.expanded ? 'w2ui-icon-collapse' : 'w2ui-icon-expand')
                        : 'w2ui-icon-empty'
                    ) +'" '+
                ' onclick="event.stopPropagation(); w2ui[\''+ this.name + '\'].toggle(jQuery(this).parents(\'tr\').attr(\'recid\'))"></span>'
        }
        // info bubble
        if (col.info === true) col.info = {}
        if (col.info != null) {
            let infoIcon = 'w2ui-icon-info'
            if (typeof col.info.icon == 'function') {
                infoIcon = col.info.icon(record)
            } else if (typeof col.info.icon == 'object') {
                infoIcon = col.info.icon[this.parseField(record, col.field)] || ''
            } else if (typeof col.info.icon == 'string') {
                infoIcon = col.info.icon
            }
            let infoStyle = col.info.style || ''
            if (typeof col.info.style == 'function') {
                infoStyle = col.info.style(record)
            } else if (typeof col.info.style == 'object') {
                infoStyle = col.info.style[this.parseField(record, col.field)] || ''
            } else if (typeof col.info.style == 'string') {
                infoStyle = col.info.style
            }
            infoBubble += '<span class="w2ui-info '+ infoIcon +'" style="'+ infoStyle + '" '+
                (col.info.showOn != null ? 'on' + col.info.showOn : 'onclick') +
                '="event.stopPropagation(); w2ui[\''+ this.name + '\'].showBubble('+ ind +', '+ col_ind +')"'+
                '></span>'
        }
        let data = value
        // if editable checkbox
        if (edit && ['checkbox', 'check'].indexOf(edit.type) != -1) {
            let changeInd = summary ? -(ind + 1) : ind
            divStyle += 'text-align: center;'
            data  = '<input tabindex="-1" type="checkbox" '+ (data ? 'checked="checked"' : '') +' onclick="' +
                    '    let obj = w2ui[\''+ this.name + '\']; '+
                    '    obj.editChange.call(obj, this, '+ changeInd +', '+ col_ind +', event); ' +
                    '"/>'
            infoBubble    = ''
        }
        data = `<div style="${divStyle}" ${getTitle(data)} ${divAttr}>${infoBubble}${String(data)}</div>`
        if (data == null) data = ''
        // --> cell TD
        if (typeof col.render == 'string') {
            let tmp = col.render.toLowerCase().split(':')
            if (['number', 'int', 'float', 'money', 'currency', 'percent', 'size'].indexOf(tmp[0]) != -1) {
                style += 'text-align: right;'
            }
        }
        if (record && record.w2ui) {
            if (typeof record.w2ui.style == 'object') {
                if (typeof record.w2ui.style[col_ind] == 'string') style += record.w2ui.style[col_ind] + ';'
                if (typeof record.w2ui.style[col.field] == 'string') style += record.w2ui.style[col.field] + ';'
            }
            if (typeof record.w2ui.class == 'object') {
                if (typeof record.w2ui.class[col_ind] == 'string') className += record.w2ui.class[col_ind] + ' '
                if (typeof record.w2ui.class[col.field] == 'string') className += record.w2ui.class[col.field] + ' '
            }
        }
        let isCellSelected = false
        if (isRowSelected && $.inArray(col_ind, sel.columns[ind]) != -1) isCellSelected = true
        // clipboardCopy
        let clipboardTxt, clipboardIcon
        if (col.clipboardCopy){
            clipboardTxt  = (typeof col.clipboardCopy == 'string' ? col.clipboardCopy : w2utils.lang('Copy to clipboard'))
            clipboardIcon = `<span onmouseEnter="jQuery(this).w2tag('${clipboardTxt}', { name: '${this.name}-bubble', position: 'top|bottom' })"
                onclick="w2ui['${this.name}'].clipboardCopy(${ind}, ${col_ind}); jQuery(this).w2tag(w2utils.lang('Copied'), { name: '${this.name}-bubble', position: 'top|bottom' }); event.stopPropagation();"
                onmouseLeave="jQuery(this).w2tag({ name: '${this.name}-bubble' })" class="w2ui-clipboard-copy w2ui-icon-paste"></span>`
        }
        // data
        data = '<td class="w2ui-grid-data'+ (isCellSelected ? ' w2ui-selected' : '') + ' ' + className +
                    (isChanged ? ' w2ui-changed' : '') + '" '+
                '   id="grid_'+ this.name +'_data_'+ ind +'_'+ col_ind +'" col="'+ col_ind +'" '+
                '   style="'+ style + (col.style != null ? col.style : '') +'" '+
                    (col.attr != null ? col.attr : '') + attr +
                    (col_span > 1 ? 'colspan="'+ col_span + '"' : '') +
                '>' + data + (clipboardIcon && w2utils.stripTags(data) ? clipboardIcon : '') +'</td>'
        // summary top row
        if (ind === -1 && summary === true) {
            data = '<td class="w2ui-grid-data" col="'+ col_ind +'" style="height: 0px; '+ style + '" '+
                        (col_span > 1 ? 'colspan="'+ col_span + '"' : '') +
                    '></td>'
        }
        return data
        function getTitle(cellData){
            let title
            if (obj.show.recordTitles) {
                if (col.title != null) {
                    if (typeof col.title == 'function') title = col.title.call(obj, record, ind, col_ind)
                    if (typeof col.title == 'string') title = col.title
                } else {
                    title = w2utils.stripTags(String(cellData).replace(/"/g, '\'\''))
                }
            }
            return (title != null) ? 'title="' + String(title) + '"' : ''
        }
    }
    clipboardCopy(ind, col_ind) {
        let rec = this.records[ind]
        let col = this.columns[col_ind]
        let txt = (col ? this.parseField(rec, col.field) : '')
        if (typeof col.clipboardCopy == 'function') {
            txt = col.clipboardCopy(rec)
        }
        $(this.box).find('#grid_' + this.name + '_focus').text(txt).select()
        document.execCommand('copy')
    }
    showBubble(ind, col_ind) {
        let info = this.columns[col_ind].info
        if (!info) return
        let html = ''
        let rec  = this.records[ind]
        let el   = query(this.box).find('#grid_'+ this.name +'_data_'+ ind +'_'+ col_ind + ' .w2ui-info')
        if (this.last.bubbleEl) {
            w2tooltip.hide(this.name + '-bubble')
        }
        this.last.bubbleEl = el
        // if no fields defined - show all
        if (info.fields == null) {
            info.fields = []
            for (let i = 0; i < this.columns.length; i++) {
                let col = this.columns[i]
                info.fields.push(col.field + (typeof col.render == 'string' ? ':' + col.render : ''))
            }
        }
        let fields = info.fields
        if (typeof fields == 'function') {
            fields = fields(rec, ind, col_ind) // custom renderer
        }
        // generate html
        if (typeof info.render == 'function') {
            html = info.render(rec, ind, col_ind)
        } else if (Array.isArray(fields)) {
            // display mentioned fields
            html = '<table cellpadding="0" cellspacing="0">'
            for (let i = 0; i < fields.length; i++) {
                let tmp = String(fields[i]).split(':')
                if (tmp[0] == '' || tmp[0] == '-' || tmp[0] == '--' || tmp[0] == '---') {
                    html += '<tr><td colspan=2><div style="border-top: '+ (tmp[0] == '' ? '0' : '1') +'px solid #C1BEBE; margin: 6px 0px;"></div></td></tr>'
                    continue
                }
                let col = this.getColumn(tmp[0])
                if (col == null) col = { field: tmp[0], caption: tmp[0] } // if not found in columns
                let val = (col ? this.parseField(rec, col.field) : '')
                if (tmp.length > 1) {
                    if (w2utils.formatters[tmp[1]]) {
                        val = w2utils.formatters[tmp[1]](val, tmp[2] || null, rec)
                    } else {
                        console.log('ERROR: w2utils.formatters["'+ tmp[1] + '"] does not exists.')
                    }
                }
                if (info.showEmpty !== true && (val == null || val == '')) continue
                if (info.maxLength != null && typeof val == 'string' && val.length > info.maxLength) val = val.substr(0, info.maxLength) + '...'
                html += '<tr><td>' + col.text + '</td><td>' + ((val === 0 ? '0' : val) || '') + '</td></tr>'
            }
            html += '</table>'
        } else if ($.isPlainObject(fields)) {
            // display some fields
            html = '<table cellpadding="0" cellspacing="0">'
            for (let caption in fields) {
                let fld = fields[caption]
                if (fld == '' || fld == '-' || fld == '--' || fld == '---') {
                    html += '<tr><td colspan=2><div style="border-top: '+ (fld == '' ? '0' : '1') +'px solid #C1BEBE; margin: 6px 0px;"></div></td></tr>'
                    continue
                }
                let tmp = String(fld).split(':')
                let col = this.getColumn(tmp[0])
                if (col == null) col = { field: tmp[0], caption: tmp[0] } // if not found in columns
                let val = (col ? this.parseField(rec, col.field) : '')
                if (tmp.length > 1) {
                    if (w2utils.formatters[tmp[1]]) {
                        val = w2utils.formatters[tmp[1]](val, tmp[2] || null, rec)
                    } else {
                        console.log('ERROR: w2utils.formatters["'+ tmp[1] + '"] does not exists.')
                    }
                }
                if (typeof fld == 'function') {
                    val = fld(rec, ind, col_ind)
                }
                if (info.showEmpty !== true && (val == null || val == '')) continue
                if (info.maxLength != null && typeof val == 'string' && val.length > info.maxLength) val = val.substr(0, info.maxLength) + '...'
                html += '<tr><td>' + caption + '</td><td>' + ((val === 0 ? '0' : val) || '') + '</td></tr>'
            }
            html += '</table>'
        }
        w2tooltip.show(w2utils.extend({
                name: this.name + '-bubble',
                html,
                anchor: el.get(0),
                position: 'top|bottom',
                class: 'w2ui-info-bubble',
                style: '',
                hideOn: ['doc-click']
            }, info.options ?? {}))
        .hide(() => [
            this.last.bubbleEl = null
        ])
    }
    // return null or the editable object if the given cell is editable
    getCellEditable(ind, col_ind) {
        let col = this.columns[col_ind]
        let rec = this.records[ind]
        if (!rec || !col) return null
        let edit = (rec.w2ui ? rec.w2ui.editable : null)
        if (edit === false) return null
        if (edit == null || edit === true) {
            edit = (col && Object.keys(col.editable).length > 0 ? col.editable : null)
            if (typeof(edit) === 'function') {
                let value = this.getCellValue(ind, col_ind, false)
                // same arguments as col.render()
                edit = edit.call(this, rec, ind, col_ind, value)
            }
        }
        return edit
    }
    getCellValue(ind, col_ind, summary, extra) {
        let col = this.columns[col_ind]
        let record = (summary !== true ? this.records[ind] : this.summary[ind])
        let value = this.parseField(record, col.field)
        let className = '', style = '', attr = '', divAttr = ''
        // if change by inline editing
        if (record && record.w2ui && record.w2ui.changes && record.w2ui.changes[col.field] != null) {
            value = record.w2ui.changes[col.field]
            if (value instanceof Object && Object.keys(col.editable).length > 0) { // if editable object
                if (col.options && col.options.items) {
                    let val = col.options.items.find((item) => { return item.id == value.id })
                    if (val) {
                        value = val.text
                    } else {
                        value = value.id
                    }
                } else {
                    if (value.id != null && value.text == null) value = value.id
                    if (value.text != null) value = value.text
                }
            }
        }
        // if there is a cell renderer
        if (col.render != null && ind !== -1) {
            if (typeof col.render == 'function' && record != null) {
                let html
                try {
                    html = col.render(record, { self: this, value: value, index: ind, colIndex: col_ind })
                } catch (e) {
                    throw new Error(`Render function for column "${col.field}" in grid "${this.name}": -- ` + e.message)
                }
                if (html != null && typeof html == 'object' && typeof html != 'function') {
                    if (html.id != null && html.text != null) {
                        // normalized menu kind of return
                        value = html.text
                    } else if (typeof html.html == 'string') {
                        value = (html.html || '').trim()
                    } else {
                        value = ''
                        console.log('ERROR: render function should return a primitive or an object of the following structure.',
                            { html: '', attr: '', style: '', class: '', divAttr: '' })
                    }
                    attr = html.attr ?? ''
                    style = html.style ?? ''
                    className = html.class ?? ''
                    divAttr = html.divAttr ?? ''
                } else {
                    value = String(html || '').trim()
                }
            }
            // if it is an object
            if (typeof col.render == 'object') {
                let tmp = col.render[value]
                if (tmp != null && tmp !== '') {
                    value = tmp
                }
            }
            // formatters
            if (typeof col.render == 'string') {
                let strInd = col.render.toLowerCase().indexOf(':')
                let tmp = []
                if (strInd == -1) {
                    tmp[0] = col.render.toLowerCase()
                    tmp[1] = ''
                } else {
                    tmp[0] = col.render.toLowerCase().substr(0, strInd)
                    tmp[1] = col.render.toLowerCase().substr(strInd + 1)
                }
                // formatters
                let func = w2utils.formatters[tmp[0]]
                if (col.options && col.options.autoFormat === false) {
                    func = null
                }
                value = (typeof func == 'function' ? func(value, tmp[1], record) : '')
            }
        }
        if (value == null) value = ''
        return !extra ? value : { value, attr, style, className, divAttr }
    }
    getFooterHTML() {
        return '<div>'+
            '    <div class="w2ui-footer-left"></div>'+
            '    <div class="w2ui-footer-right"></div>'+
            '    <div class="w2ui-footer-center"></div>'+
            '</div>'
    }
    status(msg) {
        if (msg != null) {
            $(this.box).find('#grid_'+ this.name +'_footer').find('.w2ui-footer-left').html(msg)
        } else {
            // show number of selected
            let msgLeft = ''
            let sel     = this.getSelection()
            if (sel.length > 0) {
                if (this.show.statusSelection && sel.length > 1) {
                    msgLeft = String(sel.length).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + w2utils.settings.groupSymbol) + ' ' + w2utils.lang('selected')
                }
                if (this.show.statusRecordID && sel.length == 1) {
                    let tmp = sel[0]
                    if (typeof tmp == 'object') tmp = tmp.recid + ', '+ w2utils.lang('Column') +': '+ tmp.column
                    msgLeft = w2utils.lang('Record ID') + ': '+ tmp + ' '
                }
            }
            $(this.box).find('#grid_'+ this.name +'_footer .w2ui-footer-left').html(msgLeft)
        }
    }
    lock(msg, showSpinner) {
        let args = Array.from(arguments)
        args.unshift(this.box)
        setTimeout(() => {
            // hide empty msg if any
            $(this.box).find('#grid_'+ this.name +'_empty_msg').remove()
            w2utils.lock(...args)
        }, 10)
    }
    unlock(speed) {
        setTimeout(() => {
            // do not unlock if there is a message
            if ($(this.box).find('.w2ui-message').not('.w2ui-closing').length > 0) return
            w2utils.unlock(this.box, speed)
        }, 25) // needed timer so if server fast, it will not flash
    }
    stateSave(returnOnly) {
        if (!w2utils.hasLocalStorage) return null
        let state = {
            columns     : [],
            show        : $.extend({}, this.show),
            last        : {
                search      : this.last.search,
                multi       : this.last.multi,
                logic       : this.last.logic,
                label       : this.last.label,
                field       : this.last.field,
                scrollTop   : this.last.scrollTop,
                scrollLeft  : this.last.scrollLeft
            },
            sortData    : [],
            searchData  : []
        }
        let prop_val
        for (let i = 0; i < this.columns.length; i++) {
            let col          = this.columns[i]
            let col_save_obj = {}
            // iterate properties to save
            Object.keys(this.stateColProps).forEach((prop, idx) => {
                if (this.stateColProps[prop]){
                    // check if the property is defined on the column
                    if (col[prop] !== undefined){
                        prop_val = col[prop]
                    } else {
                        // use fallback or null
                        prop_val = this.colDefaults[prop] || null
                    }
                    col_save_obj[prop] = prop_val
                }
            })
            state.columns.push(col_save_obj)
        }
        for (let i = 0; i < this.sortData.length; i++) state.sortData.push($.extend({}, this.sortData[i]))
        for (let i = 0; i < this.searchData.length; i++) state.searchData.push($.extend({}, this.searchData[i]))
        // event before
        let edata = this.trigger({ phase: 'before', type: 'stateSave', target: this.name, state: state })
        if (edata.isCancelled === true) {
            return
        }
        // save into local storage
        if (returnOnly !== true && this.useLocalStorage) {
            try {
                let savedState = JSON.parse(localStorage.w2ui || '{}')
                if (!savedState) savedState = {}
                if (!savedState.states) savedState.states = {}
                savedState.states[(this.stateId || this.name)] = state
                localStorage.w2ui                              = JSON.stringify(savedState)
            } catch (e) {
                delete localStorage.w2ui
                return null
            }
        }
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
        return state
    }
    stateRestore(newState) {
        let url = (typeof this.url != 'object' ? this.url : this.url.get)
        if (!newState) {
            if (!w2utils.hasLocalStorage && this.useLocalStorage) return false
            // read it from local storage
            try {
                let tmp = JSON.parse(localStorage.w2ui || '{}')
                if (!tmp) tmp = {}
                if (!tmp.states) tmp.states = {}
                newState = tmp.states[(this.stateId || this.name)]
            } catch (e) {
                delete localStorage.w2ui
                return null
            }
        }
        // event before
        let edata = this.trigger({ phase: 'before', type: 'stateRestore', target: this.name, state: newState })
        if (edata.isCancelled === true) {
            return
        }
        // default behavior
        if ($.isPlainObject(newState)) {
            $.extend(this.show, newState.show)
            $.extend(this.last, newState.last)
            let sTop  = this.last.scrollTop
            let sLeft = this.last.scrollLeft
            for (let c = 0; c < newState.columns.length; c++) {
                let tmp       = newState.columns[c]
                let col_index = this.getColumn(tmp.field, true)
                if (col_index !== null) {
                    $.extend(this.columns[col_index], tmp)
                    // restore column order from saved state
                    if (c !== col_index) this.columns.splice(c, 0, this.columns.splice(col_index, 1)[0])
                }
            }
            this.sortData.splice(0, this.sortData.length)
            for (let c = 0; c < newState.sortData.length; c++) this.sortData.push(newState.sortData[c])
            this.searchData.splice(0, this.searchData.length)
            for (let c = 0; c < newState.searchData.length; c++) this.searchData.push(newState.searchData[c])
            // apply sort and search
            setTimeout(() => {
                // needs timeout as records need to be populated
                // ez 10.09.2014 this -->
                if (!url) {
                    if (this.sortData.length > 0) this.localSort()
                    if (this.searchData.length > 0) this.localSearch()
                }
                this.last.scrollTop  = sTop
                this.last.scrollLeft = sLeft
                this.refresh()
            }, 1)
        }
        // event after
        this.trigger($.extend(edata, { phase: 'after' }))
        return true
    }
    stateReset() {
        this.stateRestore(this.last.state)
        // remove from local storage
        if (w2utils.hasLocalStorage && this.useLocalStorage) {
            try {
                let tmp = JSON.parse(localStorage.w2ui || '{}')
                if (tmp.states && tmp.states[(this.stateId || this.name)]) {
                    delete tmp.states[(this.stateId || this.name)]
                }
                localStorage.w2ui = JSON.stringify(tmp)
            } catch (e) {
                delete localStorage.w2ui
                return null
            }
        }
    }
    parseField(obj, field) {
        if (this.nestedFields) {
            let val = ''
            try { // need this to make sure no error in fields
                val     = obj
                let tmp = String(field).split('.')
                for (let i = 0; i < tmp.length; i++) {
                    val = val[tmp[i]]
                }
            } catch (event) {
                val = ''
            }
            return val
        } else {
            return obj ? obj[field] : ''
        }
    }
    prepareData() {
        let obj = this
        // loops thru records and prepares date and time objects
        for (let r = 0; r < this.records.length; r++) {
            let rec = this.records[r]
            prepareRecord(rec)
        }
        // prepare date and time objects for the 'rec' record and its closed children
        function prepareRecord(rec) {
            for (let c = 0; c < obj.columns.length; c++) {
                let column = obj.columns[c]
                if (rec[column.field] == null || typeof column.render != 'string') continue
                // number
                if (['number', 'int', 'float', 'money', 'currency', 'percent'].indexOf(column.render.split(':')[0]) != -1) {
                    if (typeof rec[column.field] != 'number') rec[column.field] = parseFloat(rec[column.field])
                }
                // date
                if (['date', 'age'].indexOf(column.render.split(':')[0]) != -1) {
                    if (!rec[column.field + '_']) {
                        let dt = rec[column.field]
                        if (w2utils.isInt(dt)) dt = parseInt(dt)
                        rec[column.field + '_'] = new Date(dt)
                    }
                }
                // time
                if (['time'].indexOf(column.render) != -1) {
                    if (w2utils.isTime(rec[column.field])) { // if string
                        let tmp = w2utils.isTime(rec[column.field], true)
                        let dt  = new Date()
                        dt.setHours(tmp.hours, tmp.minutes, (tmp.seconds ? tmp.seconds : 0), 0) // sets hours, min, sec, mills
                        if (!rec[column.field + '_']) rec[column.field + '_'] = dt
                    } else { // if date object
                        let tmp = rec[column.field]
                        if (w2utils.isInt(tmp)) tmp = parseInt(tmp)
                        tmp    = (tmp != null ? new Date(tmp) : new Date())
                        let dt = new Date()
                        dt.setHours(tmp.getHours(), tmp.getMinutes(), tmp.getSeconds(), 0) // sets hours, min, sec, mills
                        if (!rec[column.field + '_']) rec[column.field + '_'] = dt
                    }
                }
            }
            if (rec.w2ui && rec.w2ui.children && rec.w2ui.expanded !== true) {
                // there are closed children, prepare them too.
                for (let r = 0; r < rec.w2ui.children.length; r++) {
                    let subRec = rec.w2ui.children[r]
                    prepareRecord(subRec)
                }
            }
        }
    }
    nextCell(index, col_ind, editable) {
        let check = col_ind + 1
        if (check >= this.columns.length) {
            index = this.nextRow(index)
            return index == null ? index : this.nextCell(index, -1, editable)
        }
        let tmp = this.records[index].w2ui
        let col = this.columns[check]
        let span = (tmp && tmp.colspan && !isNaN(tmp.colspan[col.field]) ? parseInt(tmp.colspan[col.field]) : 1)
        if (col == null) return null
        if (col && col.hidden || span === 0) return this.nextCell(index, check, editable)
        if (editable) {
            let edit = this.getCellEditable(index, check)
            if (edit == null || ['checkbox', 'check'].indexOf(edit.type) != -1) {
                return this.nextCell(index, check, editable)
            }
        }
        return { index, colIndex: check }
    }
    prevCell(index, col_ind, editable) {
        let check = col_ind - 1
        if (check < 0) {
            index = this.prevRow(index)
            return index == null ? index : this.prevCell(index, this.columns.length, editable)
        }
        if (check < 0) return null
        let tmp = this.records[index].w2ui
        let col = this.columns[check]
        let span = (tmp && tmp.colspan && !isNaN(tmp.colspan[col.field]) ? parseInt(tmp.colspan[col.field]) : 1)
        if (col == null) return null
        if (col && col.hidden || span === 0) return this.prevCell(index, check, editable)
        if (editable) {
            let edit = this.getCellEditable(index, check)
            if (edit == null || ['checkbox', 'check'].indexOf(edit.type) != -1) {
                return this.prevCell(index, check, editable)
            }
        }
        return { index, colIndex: check }
    }
    nextRow(ind, col_ind, numRows) {
        let sids = this.last.searchIds
        let ret  = null
        if (numRows == null) numRows = 1
        if (numRows == -1) {
            return this.records.length-1
        }
        if ((ind + numRows < this.records.length && sids.length === 0) // if there are more records
                || (sids.length > 0 && ind < sids[sids.length-numRows])) {
            ind += numRows
            if (sids.length > 0) while (true) {
                if ($.inArray(ind, sids) != -1 || ind > this.records.length) break
                ind += numRows
            }
            // colspan
            let tmp  = this.records[ind].w2ui
            let col  = this.columns[col_ind]
            let span = (tmp && tmp.colspan && col != null && !isNaN(tmp.colspan[col.field]) ? parseInt(tmp.colspan[col.field]) : 1)
            if (span === 0) {
                ret = this.nextRow(ind, col_ind, numRows)
            } else {
                ret = ind
            }
        }
        return ret
    }
    prevRow(ind, col_ind, numRows) {
        let sids = this.last.searchIds
        let ret  = null
        if (numRows == null) numRows = 1
        if (numRows == -1) {
            return 0
        }
        if ((ind - numRows >= 0 && sids.length === 0) // if there are more records
                || (sids.length > 0 && ind > sids[0])) {
            ind -= numRows
            if (sids.length > 0) while (true) {
                if ($.inArray(ind, sids) != -1 || ind < 0) break
                ind -= numRows
            }
            // colspan
            let tmp  = this.records[ind].w2ui
            let col  = this.columns[col_ind]
            let span = (tmp && tmp.colspan && col != null && !isNaN(tmp.colspan[col.field]) ? parseInt(tmp.colspan[col.field]) : 1)
            if (span === 0) {
                ret = this.prevRow(ind, col_ind, numRows)
            } else {
                ret = ind
            }
        }
        return ret
    }
    selectionSave() {
        this.last._selection = this.getSelection()
        return this.last._selection
    }
    selectionRestore(noRefresh) {
        let time            = (new Date()).getTime()
        this.last.selection = { indexes: [], columns: {} }
        let sel             = this.last.selection
        let lst             = this.last._selection
        if (lst) for (let i = 0; i < lst.length; i++) {
            if ($.isPlainObject(lst[i])) {
                // selectType: cell
                let tmp = this.get(lst[i].recid, true)
                if (tmp != null) {
                    if (sel.indexes.indexOf(tmp) == -1) sel.indexes.push(tmp)
                    if (!sel.columns[tmp]) sel.columns[tmp] = []
                    sel.columns[tmp].push(lst[i].column)
                }
            } else {
                // selectType: row
                let tmp = this.get(lst[i], true)
                if (tmp != null) sel.indexes.push(tmp)
            }
        }
        delete this.last._selection
        if (noRefresh !== true) this.refresh()
        return (new Date()).getTime() - time
    }
    message(options) {
        return w2utils.message.call(this, {
            box   : this.box,
            after : '.w2ui-grid-header'
        }, options)
    }
    confirm(options) {
        return w2utils.confirm.call(this, {
            box   : this.box,
            after : '.w2ui-grid-header'
        }, options)
    }
}
/**
 * Part of w2ui 2.0 library
 *  - Dependencies: mQuery, w2utils, w2base, w2tabs, w2toolbar, w2tooltip, w2field
 *
 * == TODO ==
 *  - include delta on save
 *  - tabs below some fields (could already be implemented)
 *  - form with toolbar & tabs
 *  - promise for load, save, etc.
 *
 * == 2.0 changes
 *  - CSP - fixed inline events
 *  - removed jQuery dependency
 *  - better groups support tabs now
 *  - form.confirm - refactored
 *  - form.message - refactored
 *  - resizeObserver for the box
 *  - removed msgNotJSON, msgAJAXerror
 *  - applyFocus -> setFocus
 *  - getFieldValue(fieldName) = returns { curent, previous, original }
 *  - setFieldVallue(fieldName, value)
 *  - getValue(..., original) -- return original if any
 */

class w2form extends w2base {
    constructor(options) {
        super(options.name)
        this.name         = null
        this.header       = ''
        this.box          = null // HTML element that hold this element
        this.url          = ''
        this.routeData    = {} // data for dynamic routes
        this.formURL      = '' // url where to get form HTML
        this.formHTML     = '' // form HTML (might be loaded from the url)
        this.page         = 0 // current page
        this.pageStyle    = ''
        this.recid        = 0 // can be null or 0
        this.fields       = []
        this.actions      = {}
        this.record       = {}
        this.original     = null
        this.method       = null // only used when not null, otherwise set based on w2utils.settings.dataType
        this.dataType     = null // only used when not null, otherwise from w2utils.settings.dataType
        this.postData     = {}
        this.httpHeaders  = {}
        this.toolbar      = {} // if not empty, then it is toolbar
        this.tabs         = {} // if not empty, then it is tabs object
        this.style        = ''
        this.focus        = 0 // focus first or other element
        this.autosize     = true // autosize, if false the container must have a height set
        this.nestedFields = true // use field name containing dots as separator to look into object
        this.multipart    = false
        this.tabindexBase = 0 // this will be added to the auto numbering
        this.isGenerated  = false
        this.last         = {
            xhr: null, // jquery xhr requests
            errors: []
        }
        this.onRequest    = null
        this.onLoad       = null
        this.onValidate   = null
        this.onSubmit     = null
        this.onProgress   = null
        this.onSave       = null
        this.onChange     = null
        this.onInput      = null
        this.onRender     = null
        this.onRefresh    = null
        this.onResize     = null
        this.onDestroy    = null
        this.onAction     = null
        this.onToolbar    = null
        this.onError      = null
        this.msgRefresh   = 'Loading...'
        this.msgSaving    = 'Saving...'
        this.ALL_TYPES    = [ 'text', 'textarea', 'email', 'pass', 'password', 'int', 'float', 'money', 'currency',
            'percent', 'hex', 'alphanumeric', 'color', 'date', 'time', 'datetime', 'toggle', 'checkbox', 'radio',
            'check', 'checks', 'list', 'combo', 'enum', 'file', 'select', 'map', 'array', 'div', 'custom', 'html',
            'empty']
        this.LIST_TYPES = ['select', 'radio', 'check', 'checks', 'list', 'combo', 'enum']
        this.W2FIELD_TYPES = ['int', 'float', 'money', 'currency', 'percent', 'hex', 'alphanumeric', 'color',
            'date', 'time', 'datetime', 'list', 'combo', 'enum', 'file']
        // mix in options
        w2utils.extend(this, options)
        // When w2utils.settings.dataType is JSON, then we can convert the save request to multipart/form-data. So we can upload large files with the form
        // The original body is JSON.stringified to __body
        // remember items
        let record   = options.record
        let original = options.original
        let fields   = options.fields
        let toolbar  = options.toolbar
        let tabs     = options.tabs
        // extend items
        Object.assign(this, { record: {}, original: null, fields: [], tabs: {}, toolbar: {}, handlers: [] })
        // preprocess fields
        if (fields) {
            let sub =_processFields(fields)
            this.fields = sub.fields
            if (!tabs && sub.tabs.length > 0) {
                tabs = sub.tabs
            }
        }
        // prepare tabs
        if (Array.isArray(tabs)) {
            w2utils.extend(this.tabs, { tabs: [] })
            for (let t = 0; t < tabs.length; t++) {
                let tmp = tabs[t]
                if (typeof tmp === 'object') {
                    this.tabs.tabs.push(tmp)
                    if(tmp.active === true) {
                        this.tabs.active = tmp.id
                    }
                } else {
                    this.tabs.tabs.push({ id: tmp, text: tmp })
                }
            }
        } else {
            w2utils.extend(this.tabs, tabs)
        }
        w2utils.extend(this.toolbar, toolbar)
        for (let p in record) { // it is an object
            if (w2utils.isPlainObject(record[p])) {
                this.record[p] = w2utils.clone(record[p])
            } else {
                this.record[p] = record[p]
            }
        }
        for (let p in original) { // it is an object
            if (w2utils.isPlainObject(original[p])) {
                this.original[p] = w2utils.clone(original[p])
            } else {
                this.original[p] = original[p]
            }
        }
        // generate html if necessary
        if (this.formURL !== '') {
            fetch(this.formURL)
                .then(resp => resp.text())
                .then(text => {
                    this.formHTML = text
                    this.isGenerated = true
                })
        } else if (!this.formURL && !this.formHTML) {
            this.formHTML    = this.generateHTML()
            this.isGenerated = true
        }
        function _processFields(fields) {
            let newFields = []
            let tabs = []
            // if it is an object
            if (w2utils.isPlainObject(fields)) {
                let tmp = fields
                fields = []
                Object.keys(tmp).forEach((key) => {
                    let fld = tmp[key]
                    if (fld.type == 'group') {
                        fld.text = key
                        if (w2utils.isPlainObject(fld.fields)) {
                            let tmp2 = fld.fields
                            fld.fields = []
                            Object.keys(tmp2).forEach((key2) => {
                                let fld2 = tmp2[key2]
                                fld2.field = key2
                                fld.fields.push(_process(fld2))
                            })
                        }
                        fields.push(fld)
                    } else if (fld.type == 'tab') {
                        // add tab
                        let tab = { id: key, text: key }
                        if (fld.style) {
                            tab.style = fld.style
                        }
                        tabs.push(tab)
                        // add page to fields
                        let sub = _processFields(fld.fields).fields
                        sub.forEach(fld2 => {
                            fld2.html = fld2.html || {}
                            fld2.html.page = tabs.length -1
                            _process2(fld, fld2)
                        })
                        fields.push(...sub)
                    } else {
                        fld.field = key
                        fields.push(_process(fld))
                    }
                })
                function _process(fld) {
                    let ignore = ['html']
                    if (fld.html == null) fld.html = {}
                    Object.keys(fld).forEach((key => {
                        if (ignore.indexOf(key) != -1) return
                        if (['label', 'attr', 'style', 'text', 'span', 'page', 'column', 'anchor',
                            'group', 'groupStyle', 'groupTitleStyle', 'groupCollapsible'].indexOf(key) != -1) {
                            fld.html[key] = fld[key]
                            delete fld[key]
                        }
                    }))
                    return fld
                }
                function _process2(fld, fld2) {
                    let ignore = ['style', 'html']
                    Object.keys(fld).forEach((key => {
                        if (ignore.indexOf(key) != -1) return
                        if (['span', 'column', 'attr', 'text', 'label'].indexOf(key) != -1) {
                            if (fld[key] && !fld2.html[key]) {
                                fld2.html[key] = fld[key]
                            }
                        }
                    }))
                }
            }
            // process groups
            fields.forEach(field => {
                if (field.type == 'group') {
                    // group properties
                    let group = {
                        group: field.text || '',
                        groupStyle: field.style || '',
                        groupTitleStyle: field.titleStyle || '',
                        groupCollapsible: field.collapsible === true ? true : false,
                    }
                    // loop through fields
                    if (Array.isArray(field.fields)) {
                        field.fields.forEach(gfield => {
                            let fld = w2utils.clone(gfield)
                            if (fld.html == null) fld.html = {}
                            w2utils.extend(fld.html, group)
                            Array('span', 'column', 'attr', 'label', 'page').forEach(key => {
                                if (fld.html[key] == null && field[key] != null) {
                                    fld.html[key] = field[key]
                                }
                            })
                            if (fld.field == null && fld.name != null) {
                                console.log('NOTICE: form field.name property is deprecated, please use field.field. Field ->', field)
                                fld.field = fld.name
                            }
                            newFields.push(fld)
                        })
                    }
                } else {
                    let fld = w2utils.clone(field)
                    if (fld.field == null && fld.name != null) {
                        console.log('NOTICE: form field.name property is deprecated, please use field.field. Field ->', field)
                        fld.field = fld.name
                    }
                    newFields.push(fld)
                }
            })
            return { fields: newFields, tabs }
        }
    }
    get(field, returnIndex) {
        if (arguments.length === 0) {
            let all = []
            for (let f1 = 0; f1 < this.fields.length; f1++) {
                if (this.fields[f1].field != null) all.push(this.fields[f1].field)
            }
            return all
        } else {
            for (let f2 = 0; f2 < this.fields.length; f2++) {
                if (this.fields[f2].field == field) {
                    if (returnIndex === true) return f2; else return this.fields[f2]
                }
            }
            return null
        }
    }
    set(field, obj) {
        for (let f = 0; f < this.fields.length; f++) {
            if (this.fields[f].field == field) {
                w2utils.extend(this.fields[f] , obj)
                this.refresh(field)
                return true
            }
        }
        return false
    }
    getValue(field, original) {
        if (this.nestedFields) {
            let val = undefined
            try { // need this to make sure no error in fields
                let rec = original === true ? this.original : this.record
                val = String(field).split('.').reduce((rec, i) => { return rec[i] }, rec)
            } catch (event) {
            }
            return val
        } else {
            return this.record[field]
        }
    }
    setValue(field, value) {
        // will not refresh the form!
        if (value === '' || value == null
                || (Array.isArray(value) && value.length === 0)
                || (w2utils.isPlainObject(value) && Object.keys(value).length == 0)) {
            value = null
        }
        if (this.nestedFields) {
            try { // need this to make sure no error in fields
                let rec = this.record
                String(field).split('.').map((fld, i, arr) => {
                    if (arr.length - 1 !== i) {
                        if (rec[fld]) rec = rec[fld]; else { rec[fld] = {}; rec = rec[fld] }
                    } else {
                        rec[fld] = value
                    }
                })
                return true
            } catch (event) {
                return false
            }
        } else {
            this.record[field] = value
            return true
        }
    }
    getFieldValue(name) {
        let field = this.get(name)
        if (field == null) return
        let el = field.el
        let previous = this.getValue(name)
        let original = this.getValue(name, true)
        // orginary input control
        let current = el.value
        // should not be set to '', incosistent logic
        // if (previous == null) previous = ''
        // clean extra chars
        if (['int', 'float', 'percent', 'money', 'currency'].includes(field.type)) {
            current = field.w2field.clean(current)
        }
        // radio list
        if (['radio'].includes(field.type)) {
            let selected = query(el).closest('div').find('input:checked').get(0)
            if (selected) {
                let item = field.options.items[query(selected).data('index')]
                current = item.id
            } else {
                current = null
            }
        }
        // single checkbox
        if (['toggle', 'checkbox'].includes(field.type)) {
            current = el.checked
        }
        // check list
        if (['check', 'checks'].indexOf(field.type) !== -1) {
            current = []
            let selected = query(el).closest('div').find('input:checked')
            if (selected.length > 0) {
                selected.each(el => {
                    let item = field.options.items[query(el).data('index')]
                    current.push(item.id)
                })
            }
            if (!Array.isArray(previous)) previous = []
        }
        // lists
        let selected = el._w2field?.selected // drop downs and other w2field objects
        if (['list', 'enum', 'file'].includes(field.type) && selected) {
            // TODO: check when w2field is refactored
            let nv = selected
            let cv = previous
            if (Array.isArray(nv)) {
                current = []
                for (let i = 0; i < nv.length; i++) current[i] = w2utils.clone(nv[i]) // clone array
            }
            if (Array.isArray(cv)) {
                previous = []
                for (let i = 0; i < cv.length; i++) previous[i] = w2utils.clone(cv[i]) // clone array
            }
            if (w2utils.isPlainObject(nv)) {
                current = w2utils.clone(nv) // clone object
            }
            if (w2utils.isPlainObject(cv)) {
                previous = w2utils.clone(cv) // clone object
            }
        }
        // map, array
        if (['map', 'array'].includes(field.type)) {
            current = (field.type == 'map' ? {} : [])
            field.$el.parent().find('.w2ui-map-field').each(div => {
                let key = query(div).find('.w2ui-map.key').val()
                let value = query(div).find('.w2ui-map.value').val()
                if (field.type == 'map') {
                    current[key] = value
                } else {
                    current.push(value)
                }
            })
        }
        return { current, previous, original } // current - in input, previous - in form.record, original - before form change
    }
    setFieldValue(name, value) {
        let field = this.get(name)
        if (field == null) return
        let el = field.el
        switch(field.type) {
            case 'toggle':
            case 'checkbox':
                el.checked = value ? true : false
                break
            case 'radio': {
                value = value?.id ?? value
                let inputs = query(el).closest('div').find('input')
                let items  = field.options.items
                items.forEach((it, ind) => {
                    if (it.id === value) { // need exact match so to match empty string and 0
                        inputs.filter(`[data-index="${ind}"]`).prop('checked', true)
                    }
                })
                break
            }
            case 'check':
            case 'checks': {
                if (!Array.isArray(value)) value = [value]
                value = value.map(val => val?.id ?? val) // convert if array of objects
                let inputs = query(el).closest('div').find('input')
                let items  = field.options.items
                items.forEach((it, ind) => {
                    inputs.filter(`[data-index="${ind}"]`).prop('checked', value.includes(it.id) ? true : false)
                })
                break
            }
            case 'list':
            case 'combo':
                // TODO: finish when w2field is refactored
                let item = value
                // find item in options.items, if any
                if (item?.id == null) {
                    field.options.items.forEach(it => {
                        if (it.id === value) item = it
                    })
                }
                if (item != value) {
                    this.setValue(field.name, item)
                }
                if (field.type == 'list') {
                    field.w2field.selected = item
                    field.w2field.refresh()
                } else {
                    field.el.value = item?.text ?? value
                }
                break
            case 'enum':
            case 'file': {
                // TODO: finish when w2field is refactored
                let items = value
                if (!Array.isArray(items)) items = [items]
                if (!Array.isArray(value)) value = [value]
                // find item in options.items, if any
                let updated = false
                items.forEach((item, ind) => {
                    if (item?.id == null && Array.isArray(field.options.items)) {
                        field.options.items.forEach(it => {
                            if (it.id == item) {
                                items[ind] = it
                                updated = true
                            }
                        })
                    }
                })
                if (updated) {
                    this.setValue(field.name, items)
                }
                // TODO: check
                // if (!isFound && value != null && value.length !== 0) {
                //     field.$el.data('find_selected', value) // HERE
                //     sel = value
                // }
                field.w2field.selected = items
                field.w2field.refresh()
                break
            }
            case 'map':
            case 'array': {
                // init map
                if (field.type == 'map' && (value == null || !w2utils.isPlainObject(value))) {
                    this.setValue(field.field, {})
                    value = this.getValue(field.field)
                }
                if (field.type == 'array' && (value == null || !Array.isArray(value))) {
                    this.setValue(field.field, [])
                    value = this.getValue(field.field)
                }
                let container = query(field.el).parent().find('.w2ui-map-container')
                field.el.mapRefresh(value, container)
                break
            }
            case 'div':
            case 'custom':
                query(el).html(value)
                break
            case 'html':
            case 'empty':
                break
            default:
                el.value = value
                break
        }
    }
    show() {
        let effected = []
        for (let a = 0; a < arguments.length; a++) {
            let fld = this.get(arguments[a])
            if (fld && fld.hidden) {
                fld.hidden = false
                effected.push(fld.field)
            }
        }
        if (effected.length > 0) this.refresh.apply(this, effected)
        this.updateEmptyGroups()
        return effected
    }
    hide() {
        let effected = []
        for (let a = 0; a < arguments.length; a++) {
            let fld = this.get(arguments[a])
            if (fld && !fld.hidden) {
                fld.hidden = true
                effected.push(fld.field)
            }
        }
        if (effected.length > 0) this.refresh.apply(this, effected)
        this.updateEmptyGroups()
        return effected
    }
    enable() {
        let effected = []
        for (let a = 0; a < arguments.length; a++) {
            let fld = this.get(arguments[a])
            if (fld && fld.disabled) {
                fld.disabled = false
                effected.push(fld.field)
            }
        }
        if (effected.length > 0) this.refresh.apply(this, effected)
        return effected
    }
    disable() {
        let effected = []
        for (let a = 0; a < arguments.length; a++) {
            let fld = this.get(arguments[a])
            if (fld && !fld.disabled) {
                fld.disabled = true
                effected.push(fld.field)
            }
        }
        if (effected.length > 0) this.refresh.apply(this, effected)
        return effected
    }
    updateEmptyGroups() {
        // hide empty groups
        query(this.box).find('.w2ui-group').each((group) =>{
            if (isHidden(query(group).find('.w2ui-field'))) {
                query(group).hide()
            } else {
                query(group).show()
            }
        })
        function isHidden($els) {
            let flag = true
            $els.each((el) => {
                if (el.style.display != 'none') flag = false
            })
            return flag
        }
    }
    change() {
        Array.from(arguments).forEach((field) => {
            let tmp = this.get(field)
            if (tmp.$el) tmp.$el.change()
        })
    }
    reload(callBack) {
        let url = (typeof this.url !== 'object' ? this.url : this.url.get)
        if (url && this.recid !== 0 && this.recid != null) {
            // this.clear();
            this.request(callBack)
        } else {
            // this.refresh(); // no need to refresh
            if (typeof callBack === 'function') callBack()
        }
    }
    clear() {
        if (arguments.length != 0) {
            Array.from(arguments).forEach((field) => {
                let rec = this.record
                String(field).split('.').map((fld, i, arr) => {
                    if (arr.length - 1 !== i) rec = rec[fld]; else delete rec[fld]
                })
                this.refresh(field)
            })
        } else {
            this.recid    = 0
            this.record   = {}
            this.original = null
            this.refresh()
        }
    }
    error(msg) {
        // let the management of the error outside of the form
        let edata = this.trigger('error', { target: this.name, message: msg , xhr: this.last.xhr })
        if (edata.isCancelled === true) {
            return
        }
        // need a time out because message might be already up)
        setTimeout(() => { this.message(msg) }, 1)
        // event after
        edata.finish()
    }
    message(options) {
        return w2utils.message.call(this, {
            box   : this.box,
            after : '.w2ui-form-header'
        }, options)
    }
    confirm(options) {
        return w2utils.confirm.call(this, {
            box   : this.box,
            after : '.w2ui-form-header'
        }, options)
    }
    validate(showErrors) {
        if (showErrors == null) showErrors = true
        // validate before saving
        let errors = []
        for (let f = 0; f < this.fields.length; f++) {
            let field = this.fields[f]
            if (this.getValue(field.field) == null) this.setValue(field.field, '')
            if (['int', 'float', 'currency', 'money'].indexOf(field.type) != -1) {
                let val = this.getValue(field.field)
                let min = field.options.min
                let max = field.options.max
                if (min != null && val < min) {
                    errors.push({ field: field, error: w2utils.lang('Should be more than ${min}', { min }) })
                }
                if (max != null && val > max) {
                    errors.push({ field: field, error: w2utils.lang('Should be less than ${max}', { max }) })
                }
            }
            switch (field.type) {
                case 'alphanumeric':
                    if (this.getValue(field.field) && !w2utils.isAlphaNumeric(this.getValue(field.field))) {
                        errors.push({ field: field, error: w2utils.lang('Not alpha-numeric') })
                    }
                    break
                case 'int':
                    if (this.getValue(field.field) && !w2utils.isInt(this.getValue(field.field))) {
                        errors.push({ field: field, error: w2utils.lang('Not an integer') })
                    }
                    break
                case 'percent':
                case 'float':
                    if (this.getValue(field.field) && !w2utils.isFloat(this.getValue(field.field))) {
                        errors.push({ field: field, error: w2utils.lang('Not a float') })
                    }
                    break
                case 'currency':
                case 'money':
                    if (this.getValue(field.field) && !w2utils.isMoney(this.getValue(field.field))) {
                        errors.push({ field: field, error: w2utils.lang('Not in money format') })
                    }
                    break
                case 'color':
                case 'hex':
                    if (this.getValue(field.field) && !w2utils.isHex(this.getValue(field.field))) {
                        errors.push({ field: field, error: w2utils.lang('Not a hex number') })
                    }
                    break
                case 'email':
                    if (this.getValue(field.field) && !w2utils.isEmail(this.getValue(field.field))) {
                        errors.push({ field: field, error: w2utils.lang('Not a valid email') })
                    }
                    break
                case 'checkbox':
                    // convert true/false
                    if (this.getValue(field.field) == true) {
                        this.setValue(field.field, true)
                    } else {
                        this.setValue(field.field, false)
                    }
                    break
                case 'date':
                    // format date before submit
                    if (!field.options.format) field.options.format = w2utils.settings.dateFormat
                    if (this.getValue(field.field) && !w2utils.isDate(this.getValue(field.field), field.options.format)) {
                        errors.push({ field: field, error: w2utils.lang('Not a valid date') + ': ' + field.options.format })
                    }
                    break
                case 'list':
                case 'combo':
                    break
                case 'enum':
                    break
            }
            // === check required - if field is '0' it should be considered not empty
            let val = this.getValue(field.field)
            if (field.required && field.hidden !== true && !['div', 'custom', 'html', 'empty'].includes(field.type)
                    && (val === '' || (Array.isArray(val) && val.length === 0)
                        || (w2utils.isPlainObject(val) && Object.keys(val).length == 0))) {
                errors.push({ field: field, error: w2utils.lang('Required field') })
            }
            if (field.options && field.hidden !== true && field.options.minLength > 0
                    && ['enum', 'list', 'combo'].indexOf(field.type) == -1 // since minLength is used there too
                    && this.getValue(field.field).length < field.options.minLength) {
                errors.push({ field: field, error: w2utils.lang('Field should be at least ${count} characters.', {count: field.options.minLength}) })
            }
        }
        // event before
        let edata = this.trigger('validate', { target: this.name, errors: errors })
        if (edata.isCancelled === true) return
        // show error
        this.last.errors = errors
        if (showErrors) this.showErrors()
        // event after
        edata.finish()
        return errors
    }
    showErrors() {
        // TODO: check edge cases
        // -- scroll
        // -- invisible pages
        let errors = this.last.errors
        if (errors.length <= 0) return
        // show errors
        this.goto(errors[0].field.page)
        query(errors[0].field.$el).parents('.w2ui-field')[0].scrollIntoView(true)
        // show errors
        // show only for visible controls
        errors.forEach(error => {
            let opt = w2utils.extend({
                anchorClass: 'w2ui-error',
                class: 'w2ui-light',
                position: 'right|left',
                hideOn: ['input']
            }, error.options)
            if (error.field == null) return
            let anchor = error.field.el
            if (error.field.type === 'radio') { // for radio and checkboxes
                anchor = query(error.field.el).closest('div').get(0)
            } else if (['enum', 'file'].includes(error.field.type)) {
                // TODO: check
                // anchor = (error.field.el).data('w2field').helpers.multi
                // $(fld).addClass('w2ui-error')
            }
            w2tooltip.show(w2utils.extend({
                anchor,
                name: `${this.name}-${error.field.field}-error`,
                html: error.error
            }, opt))
        })
        // hide errors on scroll
        query(errors[0].field.$el).parents('.w2ui-page')
            .off('.hideErrors')
            .on('scroll.hideErrors', (evt) => {
                errors.forEach(error => {
                    w2tooltip.hide(`${this.name}-${error.field.field}-error`)
                })
            })
    }
    getChanges() {
        // TODO: not working on nested structures
        let diff = {}
        if (this.original != null && typeof this.original == 'object' && Object.keys(this.record).length == 0) {
            diff = doDiff(this.record, this.original, {})
        }
        return diff
        function doDiff(record, original, result) {
            if (Array.isArray(record) && Array.isArray(original)) {
                while (record.length < original.length) {
                    record.push(null)
                }
            }
            for (let i in record) {
                if (record[i] != null && typeof record[i] === 'object') {
                    result[i] = doDiff(record[i], original[i] || {}, {})
                    if (!result[i] || (Object.keys(result[i]).length == 0 && Object.keys(original[i].length == 0))) delete result[i]
                } else if (record[i] != original[i] || (record[i] == null && original[i] != null)) { // also catch field clear
                    result[i] = record[i]
                }
            }
            return Object.keys(result).length != 0 ? result : null
        }
    }
    getCleanRecord(strict) {
        let data = w2utils.clone(this.record)
        this.fields.forEach((fld) => {
            if (['list', 'combo', 'enum'].indexOf(fld.type) != -1) {
                let tmp = { nestedFields: true, record: data }
                let val = this.getValue.call(tmp, fld.field)
                if (w2utils.isPlainObject(val) && val.id != null) { // should be true if val.id === ''
                    this.setValue.call(tmp, fld.field, val.id)
                }
                if (Array.isArray(val)) {
                    val.forEach((item, ind) => {
                        if (w2utils.isPlainObject(item) && item.id) {
                            val[ind] = item.id
                        }
                    })
                }
            }
            if (fld.type == 'map') {
                let tmp = { nestedFields: true, record: data }
                let val = this.getValue.call(tmp, fld.field)
                if (val._order) delete val._order
            }
        })
        // return only records present in description
        if (strict === true) {
            Object.keys(data).forEach((key) => {
                if (!this.get(key)) delete data[key]
            })
        }
        return data
    }
    request(postData, callBack) { // if (1) param then it is call back if (2) then postData and callBack
        let self = this
        // check for multiple params
        if (typeof postData === 'function') {
            callBack = postData
            postData = null
        }
        if (postData == null) postData = {}
        if (!this.url || (typeof this.url === 'object' && !this.url.get)) return
        if (this.recid == null) this.recid = 0
        // build parameters list
        let params = {}
        // add list params
        params.cmd   = 'get'
        params.recid = this.recid
        params.name  = this.name
        // append other params
        w2utils.extend(params, this.postData)
        w2utils.extend(params, postData)
        // event before
        let edata = this.trigger('request', { target: this.name, url: this.url, method: this.method,
            postData: params, httpHeaders: this.httpHeaders })
        if (edata.isCancelled === true) {
            if (typeof callBack === 'function') {
                callBack({ error: true, message: w2utils.lang('Request aborted.') })
            }
            return
        }
        // default action
        this.record = {}
        this.original = null
        // call server to get data
        this.lock(w2utils.lang(this.msgRefresh))
        let url = edata.detail.url
        if (typeof url === 'object' && url.get) url = url.get
        // TODO: cancel previous fetch
        if (this.last.xhr) try { this.last.xhr.abort() } catch (e) {}
        // process url with routeData
        if (Object.keys(this.routeData).length != 0) {
            let info = w2utils.parseRoute(url)
            if (info.keys.length > 0) {
                for (let k = 0; k < info.keys.length; k++) {
                    if (this.routeData[info.keys[k].name] == null) continue
                    url = url.replace((new RegExp(':'+ info.keys[k].name, 'g')), this.routeData[info.keys[k].name])
                }
            }
        }
        url = new URL(url, location)
        let fetchOptions = {
            method: 'GET',
            headers: edata.detail.httpHeaders
        }
        let postParams = edata.detail.postData
        let dataType = edata.detail.dataType ?? this.dataType ?? w2utils.settings.dataType
        dataType = 'HTTP'
        switch (dataType) {
            case 'HTTP':
            case 'RESTULL': {
                Object.keys(postParams).forEach(key => url.searchParams.append(key, postParams[key]))
                break
            }
            case 'HTTPJSON':
            case 'RESTFULLJSON': {
                postParams = { request: JSON.stringify(postParams) }
                Object.keys(postParams).forEach(key => url.searchParams.append(key, postParams[key]))
                break
            }
            case 'JSON': {
                fetchOptions.method = 'POST'
                fetchOptions.body = JSON.stringify(postParams)
                fetchOptions.headers.contentType = 'application/json'
                break
            }
        }
        if (this.method) fetchOptions.method = this.method
        if (edata.detail.method) fetchOptions.method = edata.detail.method
        this.last.xhr = fetch(url, fetchOptions)
            .catch(processError)
            .then((resp) => {
                self.unlock()
                if (resp.status != 200) {
                    processError(resp)
                    return
                }
                // event before
                let edata = self.trigger('load', { target: self.name, xhr: this.last.xhr, data: resp })
                if (edata.isCancelled === true) {
                    if (typeof callBack === 'function') callBack({ error: true, message: w2utils.lang('Request aborted.') })
                    return
                }
                resp.json()
                    .catch(processError)
                    .then(data => {
                        if (!data.record) {
                            data = {
                                error: false,
                                record: data
                            }
                        }
                        // server response error, not due to network issues
                        if (data.error === true) {
                            self.error(w2utils.lang(data.message))
                        } else {
                            self.record = w2utils.clone(data.record)
                        }
                        // event after
                        edata.finish()
                        self.refresh()
                        self.setFocus()
                        // call back
                        if (typeof callBack === 'function') callBack(data)
                    })
            })
        // event after
        edata.finish()
        return
        function processError(response) {
            self.unlock()
            // trigger event
            let edata2 = self.trigger('error', { response, xhr: self.last.xhr })
            if (edata2.isCancelled === true) return
            // default behavior
            if (response.status && response.status != 200) {
                self.error(response.status + ': ' + response.statusText)
            } else {
                console.log('ERROR: Server request failed.', response, '. ',
                    'Expected Response:', { error: false, record: { field1: 1, field2: 'item' }},
                    'OR:', { error: true, message: 'Error description' })
                self.error(String(response))
            }
            // event after
            edata2.finish()
        }
    }
    submit(postData, callBack) {
        return this.save(postData, callBack)
    }
    save(postData, callBack) {
        let self = this
        // check for multiple params
        if (typeof postData === 'function') {
            callBack = postData
            postData = null
        }
        // validation
        let errors = self.validate(true)
        if (errors.length !== 0) return
        // submit save
        if (postData == null) postData = {}
        if (!self.url || (typeof self.url === 'object' && !self.url.save)) {
            console.log('ERROR: Form cannot be saved because no url is defined.')
            return
        }
        self.lock(w2utils.lang(self.msgSaving) + ' <span id="'+ self.name +'_progress"></span>')
        // build parameters list
        let params = {}
        // add list params
        params.cmd   = 'save'
        params.recid = self.recid
        params.name  = self.name
        // append other params
        w2utils.extend(params, self.postData)
        w2utils.extend(params, postData)
        // clear up files
        if (!self.multipart)
            self.fields.forEach((item) => {
                if (item.type === 'file' && Array.isArray(self.getValue(item.field))) {
                    self.getValue(item.field).forEach((fitem) => {
                        delete fitem.file
                    })
                }
            })
        params.record = w2utils.clone(self.record)
        // event before
        let edata = self.trigger('submit', { target: self.name, url: self.url, method: self.method,
            postData: params, httpHeaders: self.httpHeaders })
        if (edata.isCancelled === true) return
        // default action
        let url = edata.detail.url
        if (typeof url === 'object' && url.save) url = url.save
        // TODO: abort if called twice
        // if (self.last.xhr) try { self.last.xhr.abort() } catch (e) {}
        // process url with routeData
        if (Object.keys(self.routeData).length > 0) {
            let info = w2utils.parseRoute(url)
            if (info.keys.length > 0) {
                for (let k = 0; k < info.keys.length; k++) {
                    if (self.routeData[info.keys[k].name] == null) continue
                    url = url.replace((new RegExp(':'+ info.keys[k].name, 'g')), self.routeData[info.keys[k].name])
                }
            }
        }
        url = new URL(url, location)
        let fetchOptions = {
            method: 'POST',
            headers: edata.detail.httpHeaders,
            body: edata.detail.postData
            // TODO: check multiplart save
            // xhr() {
            //     let xhr = new window.XMLHttpRequest()
            //     // upload
            //     xhr.upload.addEventListener('progress', function progress(evt) {
            //         if (evt.lengthComputable) {
            //             let edata3 = self.trigger('progress', { total: evt.total, loaded: evt.loaded, originalEvent: evt })
            //             if (edata3.isCancelled === true) return
            //             // only show % if it takes time
            //             let percent = Math.round(evt.loaded / evt.total * 100)
            //             if ((percent && percent != 100) || $(self.box).find('#'+ self.name + '_progress').text() != '') {
            //                 $(self.box).find('#'+ self.name + '_progress').text(''+ percent + '%')
            //             }
            //             // event after
            //             edata3.finish()
            //         }
            //     }, false)
            //     return xhr
            // }
        }
        let dataType = edata.detail.dataType ?? this.dataType ?? w2utils.settings.dataType
        let postParams = edata.detail.postData
        switch (dataType) {
            case 'HTTP':
                fetchOptions.type = 'GET'
                Object.keys(postParams).forEach(key => url.searchParams.append(key, postParams[key]))
                delete fetchOptions.body
                break
            case 'HTTPJSON':
                fetchOptions.type = 'GET'
                postParams = JSON.stringify({ request: postParams })
                Object.keys(postParams).forEach(key => url.searchParams.append(key, postParams[key]))
                delete fetchOptions.body
                break
            case 'RESTFULL':
                break
            case 'RESTFULLJSON':
                fetchOptions.body = JSON.stringify(fetchOptions.body)
                fetchOptions.headers.contentType = 'application/json'
                break
            case 'JSON':
                fetchOptions.headers.contentType = 'application/json'
                if (!self.multipart) {
                    fetchOptions.body = JSON.stringify(fetchOptions.body)
                } else {
                    // TODO: check file upload processing
                    function append(fd, dob, fob, p){
                        if (p == null) p = ''
                        function isObj(dob, fob, p){
                            if (typeof dob === 'object' && dob instanceof File) fd.append(p, dob)
                            if (typeof dob === 'object'){
                                if (!!dob && dob.constructor === Array) {
                                    for (let i = 0; i < dob.length; i++) {
                                        let aux_fob = !!fob ? fob[i] : fob
                                        isObj(dob[i], aux_fob, p+'['+i+']')
                                    }
                                } else {
                                    append(fd, dob, fob, p)
                                }
                            }
                        }
                        for(let prop in dob){
                            let aux_p   = p == '' ? prop : '${p}[${prop}]'
                            let aux_fob = !!fob ? fob[prop] : fob
                            isObj(dob[prop], aux_fob, aux_p)
                        }
                    }
                    let fdata = new FormData()
                    fdata.append('__body', JSON.stringify(fetchOptions.body))
                    append(fdata, fetchOptions.body)
                    fetchOptions.body = fdata
                    // fetchOptions.contentType = false
                    // fetchOptions.processData = false
                }
                break
        }
        if (this.method) fetchOptions.method = this.method
        if (edata.detail.method) fetchOptions.method = edata.detail.method
        this.last.xhr = fetch(url, fetchOptions)
            .catch(processError)
            .then(resp => {
                self.unlock()
                if (resp.status != 200) {
                    processError(resp)
                    return
                }
                // event before
                let edata = self.trigger('save', { target: self.name, xhr: this.last.xhr, data: resp })
                if (edata.isCancelled === true) return
                // parse server response
                resp.json()
                    .catch(processError)
                    .then(data => {
                        // server error, not due to network issues
                        if (data.error === true) {
                            self.error(w2utils.lang(data.message))
                        } else {
                            self.original = null
                        }
                        // event after
                        edata.finish()
                        self.refresh()
                        // call back
                        if (typeof callBack === 'function') callBack(data, this.last.xhr)
                    })
            })
        // event after
        edata.finish()
        return
        function processError(response) {
            self.unlock()
            // trigger event
            let edata2 = self.trigger('error', { response, xhr: self.last.xhr })
            if (edata2.isCancelled === true) return
            // default behavior
            if (response.status && response.status != 200) {
                self.error(response.status + ': ' + response.statusText)
            } else {
                console.log('ERROR: Server request failed.', response, '. ',
                    'Expected Response:', { error: false, record: { field1: 1, field2: 'item' }},
                    'OR:', { error: true, message: 'Error description' })
                self.error(String(response))
            }
            // event after
            edata2.finish()
        }
    }
    lock(msg, showSpinner) {
        let args = Array.from(arguments)
        args.unshift(this.box)
        w2utils.lock(...args)
    }
    unlock(speed) {
        let box = this.box
        w2utils.unlock(box, speed)
    }
    lockPage(page, msg, spinner) {
        let $page = query(this.box).find('.page-' + page)
        if($page.length){
            // page found
            w2utils.lock($page, msg, spinner)
            return true
        }
        // page with this id not found!
        return false
    }
    unlockPage(page, speed) {
        let $page = query(this.box).find('.page-' + page)
        if ($page.length) {
            // page found
            w2utils.unlock($page, speed)
            return true
        }
        // page with this id not found!
        return false
    }
    goto(page) {
        if (this.page === page) return // already on this page
        if (page != null) this.page = page
        // if it was auto size, resize it
        if (query(this.box).data('autoSize') === true) {
            query(this.box).get(0).clientHeight = 0
        }
        this.refresh()
    }
    generateHTML() {
        let pages = [] // array for each page
        let group = ''
        let page
        let column
        let html
        let tabindex
        let tabindex_str
        for (let f = 0; f < this.fields.length; f++) {
            html         = ''
            tabindex     = this.tabindexBase + f + 1
            tabindex_str = ' tabindex="'+ tabindex +'"'
            let field    = this.fields[f]
            if (field.html == null) field.html = {}
            if (field.options == null) field.options = {}
            if (field.html.caption != null && field.html.label == null) {
                console.log('NOTICE: form field.html.caption property is deprecated, please use field.html.label. Field ->', field)
                field.html.label = field.html.caption
            }
            if (field.html.label == null) field.html.label = field.field
            field.html = w2utils.extend({ label: '', span: 6, attr: '', text: '', style: '', page: 0, column: 0 }, field.html)
            if (page == null) page = field.html.page
            if (column == null) column = field.html.column
            // input control
            let input = `<input id="${field.field}" name="${field.field}" class="w2ui-input" type="text" ${field.html.attr + tabindex_str}>`
            switch (field.type) {
                case 'pass':
                case 'password':
                    input = input.replace('type="text"', 'type="password"')
                    break
                case 'checkbox': {
                    input = `
                        <label class="w2ui-box-label">
                            <input id="${field.field}" name="${field.field}" class="w2ui-input" type="checkbox" ${field.html.attr + tabindex_str}>
                            <span>${field.html.label}</span>
                        </label>`
                    break
                }
                case 'check':
                case 'checks': {
                    if (field.options.items == null && field.html.items != null) field.options.items = field.html.items
                    let items = field.options.items
                    input = ''
                    // normalized options
                    if (!Array.isArray(items)) items = []
                    if (items.length > 0) {
                        items = w2utils.normMenu.call(this, items, field)
                    }
                    // generate
                    for (let i = 0; i < items.length; i++) {
                        input += `
                            <label class="w2ui-box-label">
                                <input id="${field.field + i}" name="${field.field}" class="w2ui-input" type="checkbox"
                                    ${field.html.attr + tabindex_str} data-value="${items[i].id}" data-index="${i}">
                                <span>&#160;${items[i].text}</span>
                            </label>
                            <br>`
                    }
                    break
                }
                case 'radio': {
                    input = ''
                    // normalized options
                    if (field.options.items == null && field.html.items != null) field.options.items = field.html.items
                    let items = field.options.items
                    if (!Array.isArray(items)) items = []
                    if (items.length > 0) {
                        items = w2utils.normMenu.call(this, items, field)
                    }
                    // generate
                    for (let i = 0; i < items.length; i++) {
                        input += `
                            <label class="w2ui-box-label">
                                <input id="${field.field + i}" name="${field.field}" class="w2ui-input" type="radio"
                                    ${field.html.attr + (i === 0 ? tabindex_str : '')}
                                    data-value="${items[i].id}" data-index="${i}">
                                <span>&#160;${items[i].text}</span>
                            </label>
                            <br>`
                    }
                    break
                }
                case 'select': {
                    input = `<select id="${field.field}" name="${field.field}" class="w2ui-input" ${field.html.attr + tabindex_str}>`
                    // normalized options
                    if (field.options.items == null && field.html.items != null) field.options.items = field.html.items
                    let items = field.options.items
                    if (!Array.isArray(items)) items = []
                    if (items.length > 0) {
                        items = w2utils.normMenu.call(this, items, field)
                    }
                    // generate
                    for (let i = 0; i < items.length; i++) {
                        input += `<option value="${items[i].id}">${items[i].text}</option>`
                    }
                    input += '</select>'
                    break
                }
                case 'textarea':
                    input = `<textarea id="${field.field}" name="${field.field}" class="w2ui-input" ${field.html.attr + tabindex_str}></textarea>`
                    break
                case 'toggle':
                    input = `<input id="${field.field}" name="${field.field}" class="w2ui-input w2ui-toggle" type="checkbox" ${field.html.attr + tabindex_str}>
                            <div><div></div></div>`
                    break
                case 'map':
                case 'array':
                    field.html.key = field.html.key || {}
                    field.html.value = field.html.value || {}
                    field.html.tabindex_str = tabindex_str
                    input = '<span style="float: right">' + (field.html.text || '') + '</span>' +
                            '<input id="'+ field.field +'" name="'+ field.field +'" type="hidden" '+ field.html.attr + tabindex_str + '>'+
                            '<div class="w2ui-map-container"></div>'
                    break
                case 'div':
                case 'custom':
                    input = '<div id="'+ field.field +'" name="'+ field.field +'" '+ field.html.attr + tabindex_str + ' class="w2ui-input">'+
                                (field && field.html && field.html.html ? field.html.html : '') +
                            '</div>'
                    break
                case 'html':
                case 'empty':
                    input = (field && field.html ? (field.html.html || '') + (field.html.text || '') : '')
                    break
            }
            if (group !== '') {
                if (page != field.html.page || column != field.html.column || (field.html.group && (group != field.html.group))) {
                    pages[page][column] += '\n   </div>\n  </div>'
                    group                = ''
                }
            }
            if (field.html.group && (group != field.html.group)) {
                let collapsible = ''
                if (field.html.groupCollapsible) {
                    collapsible = '<span class="w2ui-icon-collapse" style="width: 15px; display: inline-block; position: relative; top: -2px;"></span>'
                }
                html += '\n <div class="w2ui-group">'
                    + '\n   <div class="w2ui-group-title w2ui-eaction" style="'+ (field.html.groupTitleStyle || '') + '; '
                                    + (collapsible != '' ? 'cursor: pointer; user-select: none' : '') + '"'
                    + (collapsible != '' ? 'data-group="' + w2utils.base64encode(field.html.group) + '"' : '')
                    + (collapsible != ''
                        ? 'data-click="toggleGroup|' + field.html.group + '"'
                        : '')
                    + '>'
                    + collapsible + w2utils.lang(field.html.group) + '</div>\n'
                    + '   <div class="w2ui-group-fields" style="'+ (field.html.groupStyle || '') +'">'
                group = field.html.group
            }
            if (field.html.anchor == null) {
                let span = (field.html.span != null ? 'w2ui-span'+ field.html.span : '')
                if (field.html.span == -1) span = 'w2ui-span-none'
                let label = '<label'+ (span == 'none' ? ' style="display: none"' : '') +'>' + w2utils.lang(field.type != 'checkbox' ? field.html.label : field.html.text) +'</label>'
                if (!field.html.label) label = ''
                html += '\n      <div class="w2ui-field '+ span +'" style="'+ (field.hidden ? 'display: none;' : '') + field.html.style +'">'+
                        '\n         '+ label +
                        ((field.type === 'empty') ? input : '\n         <div>'+ input + (field.type != 'array' && field.type != 'map' ? w2utils.lang(field.type != 'checkbox' ? field.html.text : '') : '') + '</div>') +
                        '\n      </div>'
            } else {
                pages[field.html.page].anchors                    = pages[field.html.page].anchors || {}
                pages[field.html.page].anchors[field.html.anchor] = '<div class="w2ui-field w2ui-field-inline" style="'+ (field.hidden ? 'display: none;' : '') + field.html.style +'">'+
                        ((field.type === 'empty') ? input : '<div>'+ w2utils.lang(field.type != 'checkbox' ? field.html.label : field.html.text, true) + input + w2utils.lang(field.type != 'checkbox' ? field.html.text : '') + '</div>') +
                        '</div>'
            }
            if (pages[field.html.page] == null) pages[field.html.page] = {}
            if (pages[field.html.page][field.html.column] == null) pages[field.html.page][field.html.column] = ''
            pages[field.html.page][field.html.column] += html
            page                                       = field.html.page
            column                                     = field.html.column
        }
        if (group !== '') pages[page][column] += '\n   </div>\n  </div>'
        if (this.tabs.tabs) {
            for (let i = 0; i < this.tabs.tabs.length; i++) if (pages[i] == null) pages[i] = []
        }
        // buttons if any
        let buttons = ''
        if (Object.keys(this.actions).length > 0) {
            buttons += '\n<div class="w2ui-buttons">'
            tabindex = this.tabindexBase + this.fields.length + 1
            for (let a in this.actions) { // it is an object
                let act  = this.actions[a]
                let info = { text: '', style: '', 'class': '' }
                if (w2utils.isPlainObject(act)) {
                    if (act.text == null && act.caption != null) {
                        console.log('NOTICE: form action.caption property is deprecated, please use action.text. Action ->', act)
                        act.text = act.caption
                    }
                    if (act.text) info.text = act.text
                    if (act.style) info.style = act.style
                    if (act.class) info.class = act.class
                } else {
                    info.text = a
                    if (['save', 'update', 'create'].indexOf(a.toLowerCase()) !== -1) info.class = 'w2ui-btn-blue'; else info.class = ''
                }
                buttons += '\n    <button name="'+ a +'" class="w2ui-btn '+ info.class +'" style="'+ info.style +'" tabindex="'+ tabindex +'">'+
                                        w2utils.lang(info.text) +'</button>'
                tabindex++
            }
            buttons += '\n</div>'
        }
        html = ''
        for (let p = 0; p < pages.length; p++){
            html += '<div class="w2ui-page page-'+ p +'" style="' + (p !== 0 ? 'display: none;' : '') + this.pageStyle + '">'
            if (!pages[p]) {
                console.log(`ERROR: Page ${p} does not exist`)
                return false
            }
            if (pages[p].before) {
                html += pages[p].before
            }
            html += '<div class="w2ui-column-container">'
            Object.keys(pages[p]).sort().forEach((c, ind) => {
                if (c == parseInt(c)) {
                    html += '<div class="w2ui-column col-'+ c +'">' + (pages[p][c] || '') + '\n</div>'
                }
            })
            html += '\n</div>'
            if (pages[p].after) {
                html += pages[p].after
            }
            html += '\n</div>'
            // process page anchors
            if (pages[p].anchors) {
                Object.keys(pages[p].anchors).forEach((key, ind) => {
                    html = html.replace(key, pages[p].anchors[key])
                })
            }
        }
        html += buttons
        return html
    }
    toggleGroup(groupName, show) {
        let el = query(this.box).find('.w2ui-group-title[data-group="' + w2utils.base64encode(groupName) + '"]')
        if(el.length === 0) return
        let el_next = query(el.prop('nextElementSibling'))
        if (typeof show === 'undefined') {
            show = (el_next.css('display') == 'none')
        }
        if (show) {
            el_next.show()
            el.find('span').addClass('w2ui-icon-collapse').removeClass('w2ui-icon-expand')
        } else {
            el_next.hide()
            el.find('span').addClass('w2ui-icon-expand').removeClass('w2ui-icon-collapse')
        }
    }
    action(action, event) {
        let act   = this.actions[action]
        let click = act
        if (w2utils.isPlainObject(act) && act.onClick) click = act.onClick
        // event before
        let edata = this.trigger('action', { target: action, action: act, originalEvent: event })
        if (edata.isCancelled === true) return
        // default actions
        if (typeof click === 'function') click.call(this, event)
        // event after
        edata.finish()
    }
    resize() {
        let self = this
        // event before
        let edata = this.trigger('resize', { target: this.name })
        if (edata.isCancelled === true) return
        // default behaviour
        let main    = query(this.box).find(':scope > div.w2ui-form-box')
        let header  = query(this.box).find(':scope > div .w2ui-form-header')
        let toolbar = query(this.box).find(':scope > div .w2ui-form-toolbar')
        let tabs    = query(this.box).find(':scope > div .w2ui-form-tabs')
        let page    = query(this.box).find(':scope > div .w2ui-page')
        let dpage   = query(this.box).find(':scope > div .w2ui-page.page-'+ this.page + ' > div')
        let buttons = query(this.box).find(':scope > div .w2ui-buttons')
        // if no height, calculate it
        let { headerHeight, tbHeight, tabsHeight } = resizeElements()
        if (this.autosize) { // we don't need autosize every time
            let cHeight = query(this.box).get(0).clientHeight
            if (cHeight === 0 || query(this.box).data('autosize') == "yes") {
                query(this.box).css({
                    height: headerHeight + tbHeight + tabsHeight + 15 // 15 is extra height
                        + (page.length > 0 ? w2utils.getSize(dpage, 'height') : 0)
                        + (buttons.length > 0 ? w2utils.getSize(buttons, 'height') : 0)
                })
                query(this.box).data('autosize', 'yes')
            }
            resizeElements()
        }
        // event after
        edata.finish()
        function resizeElements() {
            let rect = self.box.getBoundingClientRect()
            let headerHeight = (self.header !== '' ? w2utils.getSize(header, 'height') : 0)
            let tbHeight = (Array.isArray(self.toolbar?.items) && self.toolbar?.items?.length > 0)
                ? w2utils.getSize(toolbar, 'height')
                : 0
            let tabsHeight = (Array.isArray(self.tabs?.tabs) && self.tabs?.tabs?.length > 0)
                ? w2utils.getSize(tabs, 'height')
                : 0
            // resize elements
            main.css({ width: rect.width, height: rect.height })
            toolbar.css({ top: headerHeight })
            tabs.css({ top: headerHeight + tbHeight })
            page.css({ top: headerHeight + tbHeight + tabsHeight })
            page.css({ bottom: (buttons.length > 0 ? w2utils.getSize(buttons, 'height') : 0) })
            // return some params
            return { width: rect.width, height: rect.height, headerHeight, tbHeight, tabsHeight }
        }
    }
    refresh() {
        let time = (new Date()).getTime()
        let self = this
        if (!this.box) return
        if (!this.isGenerated || !query(this.box).html()) return
        // event before
        let edata = this.trigger('refresh', { target: this.name, page: this.page, field: arguments[0], fields: arguments })
        if (edata.isCancelled === true) return
        let fields = Array.from(this.fields.keys())
        if (arguments.length > 0) {
            fields = Array.from(arguments)
                .map((fld, ind) => {
                    if (typeof fld != 'string') console.log('ERROR: Arguments in refresh functions should be field names')
                    return this.get(fld, true) // get index of field
                })
                .filter((fld, ind) => {
                    if (fld != null) return true; else return false
                })
        } else {
            // update field.page with page it belongs too
            query(this.box).find('input, textarea, select').each(el => {
                let name = (query(el).attr('name') != null ? query(el).attr('name') : query(el).attr('id'))
                let field = this.get(name)
                if (field) {
                    // find page
                    let div = query(el).closest('.w2ui-page')
                    if (div.length > 0) {
                        for (let i = 0; i < 100; i++) {
                            if (div.hasClass('page-'+i)) { field.page = i; break }
                        }
                    }
                }
            })
            // default action
            query(this.box).find('.w2ui-page').hide()
            query(this.box).find('.w2ui-page.page-' + this.page).show()
            query(this.box).find('.w2ui-form-header').html(w2utils.lang(this.header))
            // refresh tabs if needed
            if (typeof this.tabs === 'object' && Array.isArray(this.tabs.tabs) && this.tabs.tabs.length > 0) {
                query(this.box).find('#form_'+ this.name +'_tabs').show()
                this.tabs.active = this.tabs.tabs[this.page].id
                this.tabs.refresh()
            } else {
                query(this.box).find('#form_'+ this.name +'_tabs').hide()
            }
            // refresh tabs if needed
            if (typeof this.toolbar === 'object' && Array.isArray(this.toolbar.items) && this.toolbar.items.length > 0) {
                query(this.box).find('#form_'+ this.name +'_toolbar').show()
                this.toolbar.refresh()
            } else {
                query(this.box).find('#form_'+ this.name +'_toolbar').hide()
            }
        }
        // refresh values of fields
        for (let f = 0; f < fields.length; f++) {
            let field = this.fields[fields[f]]
            if (field.name == null && field.field != null) field.name = field.field
            if (field.field == null && field.name != null) field.field = field.name
            field.$el = query(this.box).find(`[name='${String(field.name).replace(/\\/g, '\\\\')}']`)
            field.el  = field.$el.get(0)
            if (field.el) field.el.id = field.name
            // TODO: check
            if (field.w2field) {
                field.w2field.reset()
            }
            field.$el
                .off('.w2form')
                .on('change.w2form', function(event) {
                    let value = self.getFieldValue(field.field)
                    // clear error class
                    if (['enum', 'file'].includes(field.type)) {
                        let helper = field.el._w2field?.helpers?.multi
                        query(helper).removeClass('w2ui-error')
                    }
                    if (this._previous != null) {
                        value.previous = this._previous
                        delete this._previous
                    }
                    // event before
                    let edata2 = self.trigger('change', { target: this.name, value, originalEvent: event })
                    if (edata2.isCancelled === true) return
                    // default behavior
                    self.setValue(this.name, value.current)
                    // event after
                    edata2.finish()
                })
                .on('input.w2form', function(event) {
                    // remember original
                    if (self.original == null) {
                        if (Object.keys(self.record).length > 0) {
                            self.original = w2utils.clone(self.record)
                        } else {
                            self.original = {}
                        }
                    }
                    let value = self.getFieldValue(field.field)
                    // save previous for change event
                    if (this._previous == null) {
                        this._previous = value.previous
                    }
                    // event before
                    let edata2 = self.trigger('input', { target: self.name, value, originalEvent: event })
                    if (edata2.isCancelled === true) return
                    // default action
                    self.setValue(this.name, value.current)
                    // event after
                    edata2.finish()
                })
            // required
            if (field.required) {
                field.$el.closest('.w2ui-field').addClass('w2ui-required')
            } else {
                field.$el.closest('.w2ui-field').removeClass('w2ui-required')
            }
            // disabled
            if (field.disabled != null) {
                if (field.disabled) {
                    if (field.$el.data('tabIndex') == null) {
                        field.$el.data('tabIndex', field.$el.prop('tabIndex'))
                    }
                    field.$el
                        .prop('readonly', true)
                        .prop('tabindex', -1)
                        .closest('.w2ui-field')
                        .addClass('w2ui-disabled')
                } else {
                    field.$el
                        .prop('readonly', false)
                        .prop('tabIndex', field.$el.data('tabIndex'))
                        .closest('.w2ui-field')
                        .removeClass('w2ui-disabled')
                }
            }
            // hidden
            let tmp = field.el
            if (!tmp) tmp = query(this.box).find('#' + field.field)
            if (field.hidden) {
                query(tmp).closest('.w2ui-field').hide()
            } else {
                query(tmp).closest('.w2ui-field').show()
            }
        }
        // attach actions on buttons
        query(this.box).find('button, input[type=button]').each(el => {
            query(el).off('click').on('click', function(event) {
                let action = this.value
                if (this.id) action = this.id
                if (this.name) action = this.name
                self.action(action, event)
            })
        })
        // init controls with record
        for (let f = 0; f < fields.length; f++) {
            let field = this.fields[fields[f]]
            let value = this.getValue(field.name) ?? ''
            if (!field.el) continue
            if (!field.$el.hasClass('w2ui-input')) field.$el.addClass('w2ui-input')
            field.type = String(field.type).toLowerCase()
            if (!field.options) field.options = {}
            // list type
            if (this.LIST_TYPES.includes(field.type)) {
                let items = field.options.items
                if (items == null) field.options.items = []
                field.options.items = w2utils.normMenu.call(this, items, field)
            }
            // HTML select
            if (field.type == 'select') {
                // generate options
                let items = field.options.items
                let options = ''
                items.forEach(item => {
                    options += `<option value="${item.id}">${item.text}</option>`
                })
                field.$el.html(options)
            }
            // w2fields
            if (this.W2FIELD_TYPES.includes(field.type)) {
                field.w2field = field.w2field
                    ?? new w2field(w2utils.extend({}, field.options, { type: field.type }))
                field.w2field.render(field.el)
            }
            // map and arrays
            if (['map', 'array'].includes(field.type)) {
                // need closure
                (function (obj, field) {
                    let keepFocus
                    field.el.mapAdd = function(field, div, cnt) {
                        let attr = (field.disabled ? ' readOnly ' : '') + (field.html.tabindex_str || '')
                        let html = `
                            <div class="w2ui-map-field" style="margin-bottom: 5px" data-index="${cnt}">
                            ${field.type == 'map'
                                ? `<input type="text" ${field.html.key.attr + attr} class="w2ui-input w2ui-map key">
                                    ${field.html.key.text || ''}
                                `
                                : ''
                            }
                            <input type="text" ${field.html.value.attr + attr} class="w2ui-input w2ui-map value">
                                ${field.html.value.text || ''}
                            </div>`
                        div.append(html)
                    }
                    field.el.mapRefresh = function(map, div) {
                        // generate options
                        let keys, $k, $v
                        if (field.type == 'map') {
                            if (!w2utils.isPlainObject(map)) map = {}
                            if (map._order == null) map._order = Object.keys(map)
                            keys = map._order
                        }
                        if (field.type == 'array') {
                            if (!Array.isArray(map)) map = []
                            keys = map.map((item, ind) => { return ind })
                        }
                        // delete extra fields (including empty one)
                        let all = div.find('.w2ui-map-field')
                        for (let i = all.length-1; i >= keys.length; i--) {
                            div.find(`div[data-index='${i}']`).remove()
                        }
                        for (let ind = 0; ind < keys.length; ind++) {
                            let key = keys[ind]
                            let fld = div.find(`div[data-index='${ind}']`)
                            // add if does not exists
                            if (fld.length == 0) {
                                field.el.mapAdd(field, div, ind)
                                fld = div.find(`div[data-index='${ind}']`)
                            }
                            fld.attr('data-key', key)
                            $k = fld.find('.w2ui-map.key')
                            $v = fld.find('.w2ui-map.value')
                            let val = map[key]
                            if (field.type == 'array') {
                                let tmp = map.filter((it) => { return it.key == key ? true : false})
                                if (tmp.length > 0) val = tmp[0].value
                            }
                            $k.val(key)
                            $v.val(val)
                            if (field.disabled === true || field.disabled === false) {
                                $k.prop('readOnly', field.disabled ? true : false)
                                $v.prop('readOnly', field.disabled ? true : false)
                            }
                        }
                        let cnt = keys.length
                        let curr = div.find(`div[data-index='${cnt}']`)
                        // if not disabled - add next if needed
                        if (curr.length === 0 && ($k.val() != '' || $v.val() != '')
                            && !($k && ($k.prop('readOnly') === true || $k.prop('disabled') === true))
                        ) {
                            field.el.mapAdd(field, div, cnt)
                        }
                        if (field.disabled === true || field.disabled === false) {
                            curr.find('.key').prop('readOnly', field.disabled ? true : false)
                            curr.find('.value').prop('readOnly', field.disabled ? true : false)
                        }
                        // attach events
                        let container = query(field.el).get(0)?.nextSibling // should be div
                        query(container).find('input.w2ui-map')
                            .off('.mapChange')
                            .on('keyup.mapChange', function(event) {
                                let $div = query(event.target).closest('.w2ui-map-field')
                                let next = $div.get(0).nextElementSibling
                                let prev = $div.get(0).previousElementSibling
                                if (event.keyCode == 13) {
                                    let el = keepFocus ?? next
                                    if (el instanceof HTMLElement) {
                                        let inp = query(el).find('input')
                                        if (inp.length > 0) {
                                            inp.get(0).focus()
                                        }
                                    }
                                    keepFocus = undefined
                                }
                                let className = query(event.target).hasClass('key') ? 'key' : 'value'
                                if (event.keyCode == 38 && prev) { // up key
                                    query(prev).find(`input.${className}`).get(0).select()
                                    event.preventDefault()
                                }
                                if (event.keyCode == 40 && next) { // down key
                                    query(next).find(`input.${className}`).get(0).select()
                                    event.preventDefault()
                                }
                            })
                            .on('keydown.mapChange', function(event) {
                                if (event.keyCode == 38 || event.keyCode == 40) {
                                    event.preventDefault()
                                }
                            })
                            .on('input.mapChange', function(event) {
                                let fld = query(event.target).closest('div')
                                let cnt = fld.data('index')
                                let next = fld.get(0).nextElementSibling
                                // if last one, add new empty
                                if (fld.find('input').val() != '' && !next) {
                                    field.el.mapAdd(field, div, parseInt(cnt) + 1)
                                } else if (fld.find('input').val() == '' && next) {
                                    let isEmpty = true
                                    query(next).find('input').each(el => {
                                        if (el.value != '') isEmpty = false
                                    })
                                    if (isEmpty) {
                                        query(next).remove()
                                    }
                                }
                            })
                            .on('change.mapChange', function(event) {
                                // remember original
                                if (self.original == null) {
                                    if (Object.keys(self.record).length > 0) {
                                        self.original = w2utils.clone(self.record)
                                    } else {
                                        self.original = {}
                                    }
                                }
                                // event before
                                let { current, previous, original } = self.getFieldValue(field.field)
                                let $cnt = query(event.target).closest('.w2ui-map-container')
                                if (field.type == 'map') current._order = []
                                $cnt.find('.w2ui-map.key').each(el => { current._order.push(el.value) })
                                let edata = self.trigger('change', { target: field.field, originalEvent: event,
                                    value: { current, previous, original }
                                })
                                if (edata.isCancelled === true) {
                                    return
                                }
                                // delete empty
                                if (field.type == 'map') {
                                    current._order = current._order.filter(k => k !== '')
                                    delete current['']
                                }
                                if (field.type == 'array') {
                                    current = current.filter(k => k !== '')
                                }
                                if (query(event.target).parent().find('input').val() == '') {
                                    keepFocus = event.target
                                }
                                self.setValue(field.field, current)
                                field.el.mapRefresh(current, div)
                                // event after
                                edata.finish()
                            })
                    }
                })(this, field)
            }
            // set value to all
            this.setFieldValue(field.field, value)
            field.$el.trigger('change')
        }
        // event after
        edata.finish()
        this.resize()
        return (new Date()).getTime() - time
    }
    render(box) {
        let time = (new Date()).getTime()
        let self = this
        if (typeof box === 'object') {
            // remove from previous box
            if (query(this.box).find('#form_'+ this.name +'_tabs').length > 0) {
                query(this.box).removeAttr('name')
                    .removeClass('w2ui-reset w2ui-form')
                    .html('')
            }
            this.box = box
        }
        if (!this.isGenerated) return
        if (!this.box) return
        // event before
        let edata = this.trigger('render', {  target: this.name, box: (box != null ? box : this.box) })
        if (edata.isCancelled === true) return
        let html = '<div class="w2ui-form-box">' +
                    (this.header !== '' ? '<div class="w2ui-form-header">' + w2utils.lang(this.header) + '</div>' : '') +
                    '    <div id="form_'+ this.name +'_toolbar" class="w2ui-form-toolbar" style="display: none"></div>' +
                    '    <div id="form_'+ this.name +'_tabs" class="w2ui-form-tabs" style="display: none"></div>' +
                        this.formHTML +
                    '</div>'
        query(this.box).attr('name', this.name)
            .addClass('w2ui-reset w2ui-form')
            .html(html)
        if (query(this.box).length > 0) query(this.box)[0].style.cssText += this.style
        w2utils.bindEvents(query(this.box).find('.w2ui-eaction'), this)
        // init toolbar regardless it is defined or not
        if (typeof this.toolbar.render !== 'function') {
            this.toolbar = new w2toolbar(w2utils.extend({}, this.toolbar, { name: this.name +'_toolbar', owner: this }))
            this.toolbar.on('click', function(event) {
                let edata = self.trigger('toolbar', { target: event.target, originalEvent: event })
                if (edata.isCancelled === true) return
                // no default action
                edata.finish()
            })
        }
        if (typeof this.toolbar === 'object' && typeof this.toolbar.render === 'function') {
            this.toolbar.render(query(this.box).find('#form_'+ this.name +'_toolbar')[0])
        }
        // init tabs regardless it is defined or not
        if (typeof this.tabs.render !== 'function') {
            this.tabs = new w2tabs(w2utils.extend({}, this.tabs, { name: this.name +'_tabs', owner: this, active: this.tabs.active }))
            this.tabs.on('click', function(event) {
                self.goto(this.get(event.target, true))
            })
        }
        if (typeof this.tabs === 'object' && typeof this.tabs.render === 'function') {
            this.tabs.render(query(this.box).find('#form_'+ this.name +'_tabs')[0])
            if(this.tabs.active) this.tabs.click(this.tabs.active)
        }
        // event after
        edata.finish()
        // after render actions
        this.resize()
        let url = (typeof this.url !== 'object' ? this.url : this.url.get)
        if (url && this.recid !== 0 && this.recid != null) {
            this.request()
        } else {
            this.refresh()
        }
        // observe div resize
        this.last.resizeObserver = new ResizeObserver(() => { this.resize() })
        this.last.resizeObserver.observe(this.box)
        // focus on load
        if (this.focus != -1) {
            let setCount = 0
            let setFocus = () => {
                if (query(self.box).find('input, select, textarea').length > 0) {
                    self.setFocus()
                } else {
                    setCount++
                    if (setCount < 20) setTimeout(setFocus, 50) // 1 sec max
                }
            }
            setFocus()
        }
        return (new Date()).getTime() - time
    }
    setFocus(focus) {
        if(typeof focus === 'undefined'){
            // no argument - use form's focus property
            focus = this.focus
        }
        let $input
        // focus field by index
        if (w2utils.isInt(focus)){
            if(focus < 0) {
                return
            }
            let inputs = query(this.box).find(
                    'div:not(.w2ui-field-helper) > input, select, textarea, ' +
                    'div > label:nth-child(1) > [type=radio]')
                .filter(':not(.file-input)')
            // find visible (offsetParent == null for any element is not visible)
            while (inputs[focus].offsetParent == null && inputs.length >= focus) {
                focus++
            }
            if (inputs[focus]) {
                $input = query(inputs[focus])
            }
        } else if (typeof focus === 'string') {
            // focus field by name
            $input = query(this.box).find(`[name='${focus}']`)
        }
        if ($input){
            $input.get(0).focus()
        }
        return $input
    }
    destroy() {
        // event before
        let edata = this.trigger('destroy', { target: this.name })
        if (edata.isCancelled === true) return
        // clean up
        if (typeof this.toolbar === 'object' && this.toolbar.destroy) this.toolbar.destroy()
        if (typeof this.tabs === 'object' && this.tabs.destroy) this.tabs.destroy()
        if (query(this.box).find('#form_'+ this.name +'_tabs').length > 0) {
            query(this.box)
                .removeAttr('name')
                .removeClass('w2ui-reset w2ui-form')
                .html('')
        }
        this.last.resizeObserver?.disconnect()
        delete w2ui[this.name]
        // event after
        edata.finish()
    }
}
/**
 * Part of w2ui 2.0 library
 *  - Dependencies: mQuery, w2utils, w2base, w2tooltip, w2color, w2menu, w2date
 *
 * == TODO ==
 *  - upload (regular files)
 *  - BUG with prefix/postfix and arrows (test in different contexts)
 *  - multiple date selection
 *  - month selection, year selections
 *  - MultiSelect - Allow Copy/Paste for single and multi values
 *  - add routeData to list/enum
 *  - ENUM, LIST: should have same as grid (limit, offset, search, sort)
 *  - ENUM, LIST: should support wild chars
 *  - add selection of predefined times (used for appointments)
 *  - options.items - can be an array
 *  - options.msgSearch - message to search for user
 *  - options.msgNoItems - can be a function
 *
 * == 2.0 changes
 *  - removed jQuery dependency
 *  - enum options.autoAdd
 *  - [numeric, date] - options.autoCorrect to enforce range and validity
 *  - silent only left for files, removed form the rest
 *  - remote source response items => records or just an array
 *  - deprecated "success" field for remote source response
 *  - CSP - fixed inline events
 *  - remove clear, use reset instead
 */

class w2field extends w2base {
    constructor(type, options) {
        super()
        // sanitization
        if (typeof type == 'string' && options == null) {
            options = { type: type }
        }
        if (typeof type == 'object' && options == null) {
            options = w2utils.clone(type)
        }
        if (typeof type == 'string' && typeof options == 'object') {
            options.type = type
        }
        options.type = String(options.type).toLowerCase()
        this.el          = null
        this.selected    = null
        this.helpers     = {} // object or helper elements
        this.type        = options.type ?? 'text'
        this.options     = w2utils.clone(options)
        this.onSearch    = options.onSearch ?? null
        this.onRequest   = options.onRequest ?? null
        this.onLoad      = options.onLoad ?? null
        this.onError     = options.onError ?? null
        this.onClick     = options.onClick ?? null
        this.onAdd       = options.onAdd ?? null
        this.onNew       = options.onNew ?? null
        this.onRemove    = options.onRemove ?? null
        this.onMouseEnter= options.onMouseEnter ?? null
        this.onMouseLeave= options.onMouseLeave ?? null
        this.onScroll    = options.onScroll ?? null
        this.tmp         = {} // temp object
        // clean up some options
        delete this.options.type
        delete this.options.onSearch
        delete this.options.onRequest
        delete this.options.onLoad
        delete this.options.onError
        delete this.options.onClick
        delete this.options.onMouseEnter
        delete this.options.onMouseLeave
        delete this.options.onScroll
    }
    render(el) {
        if (!(el instanceof HTMLElement)) {
            console.log('ERROR: Cannot init w2field on empty subject')
            return
        }
        if (el._w2field) {
            el._w2field.reset()
        } else {
            el._w2field = this
        }
        this.el = el
        this.init()
    }
    init() {
        let options = this.options
        let defaults
        // only for INPUT or TEXTAREA
        if (!['INPUT', 'TEXTAREA'].includes(this.el.tagName.toUpperCase())) {
            console.log('ERROR: w2field could only be applied to INPUT or TEXTAREA.', this.el)
            return
        }
        switch (this.type) {
            case 'text':
            case 'int':
            case 'float':
            case 'money':
            case 'currency':
            case 'percent':
            case 'alphanumeric':
            case 'bin':
            case 'hex':
                defaults = {
                    min: null,
                    max: null,
                    step: 1,
                    autoFormat: true,
                    autoCorrect: true,
                    currencyPrefix: w2utils.settings.currencyPrefix,
                    currencySuffix: w2utils.settings.currencySuffix,
                    currencyPrecision: w2utils.settings.currencyPrecision,
                    decimalSymbol: w2utils.settings.decimalSymbol,
                    groupSymbol: w2utils.settings.groupSymbol,
                    arrows: false,
                    keyboard: true,
                    precision: null,
                    prefix: '',
                    suffix: ''
                }
                this.options = w2utils.extend({}, defaults, options)
                options = this.options // since object is re-created, need to re-assign
                options.numberRE  = new RegExp('['+ options.groupSymbol + ']', 'g')
                options.moneyRE   = new RegExp('['+ options.currencyPrefix + options.currencySuffix + options.groupSymbol +']', 'g')
                options.percentRE = new RegExp('['+ options.groupSymbol + '%]', 'g')
                // no keyboard support needed
                if (['text', 'alphanumeric', 'hex', 'bin'].includes(this.type)) {
                    options.arrows   = false
                    options.keyboard = false
                }
                this.addPrefix() // only will add if needed
                this.addSuffix()
                break
            case 'color':
                defaults     = {
                    prefix      : '#',
                    suffix      : `<div style="width: ${(parseInt(getComputedStyle(this.el)['font-size'])) || 12}px">&#160;</div>`,
                    arrows      : false,
                    advanced    : null, // open advanced by default
                    transparent : true
                }
                this.options = w2utils.extend({}, defaults, options)
                options = this.options // since object is re-created, need to re-assign
                this.addPrefix() // only will add if needed
                this.addSuffix() // only will add if needed
                break
            case 'date':
                defaults = {
                    format        : w2utils.settings.dateFormat, // date format
                    keyboard      : true,
                    autoCorrect   : true,
                    start         : null,
                    end           : null,
                    blockDates    : [], // array of blocked dates // TODO: check
                    blockWeekdays : [], // blocked weekdays 0 - sunday, 1 - monday, etc
                    colored       : {}, // ex: { '3/13/2022': 'bg-color|text-color' }
                    btnNow        : true
                }
                this.options = w2utils.extend({ type: 'date' }, defaults, options)
                options = this.options // since object is re-created, need to re-assign
                if (query(this.el).attr('placeholder') == null) {
                    query(this.el).attr('placeholder', options.format)
                }
                break
            case 'time':
                defaults     = {
                    format      : w2utils.settings.timeFormat,
                    keyboard    : true,
                    autoCorrect : true,
                    start       : null,
                    end         : null,
                    btnNow      : true,
                    noMinutes   : false
                }
                this.options = w2utils.extend({ type: 'time' }, defaults, options)
                options = this.options // since object is re-created, need to re-assign
                if (query(this.el).attr('placeholder') == null) {
                    query(this.el).attr('placeholder', options.format)
                }
                break
            case 'datetime':
                defaults     = {
                    format        : w2utils.settings.dateFormat + '|' + w2utils.settings.timeFormat,
                    keyboard      : true,
                    autoCorrect   : true,
                    start         : null,
                    end           : null,
                    startTime     : null,
                    endTime       : null,
                    blockDates    : [], // array of blocked dates
                    blockWeekdays : [], // blocked weekdays 0 - sunday, 1 - monday, etc
                    colored       : {}, // ex: { '3/13/2022': 'bg-color|text-color' }
                    btnNow        : true,
                    noMinutes     : false // TODO: check
                }
                this.options = w2utils.extend({ type: 'datetime' }, defaults, options)
                options = this.options // since object is re-created, need to re-assign
                if (query(this.el).attr('placeholder') == null) {
                    query(this.el).attr('placeholder', options.placeholder || options.format)
                }
                break
            case 'list':
            case 'combo':
                defaults = {
                    items           : [],
                    selected        : {},
                    url             : null, // url to pull data from // TODO: implement
                    recId           : null, // map retrieved data from url to id, can be string or function
                    recText         : null, // map retrieved data from url to text, can be string or function
                    method          : null, // default comes from w2utils.settings.dataType
                    interval        : 350, // number of ms to wait before sending server call on search
                    postData        : {},
                    minLength       : 1, // min number of chars when trigger search
                    cacheMax        : 250,
                    maxDropHeight   : 350, // max height for drop down menu
                    maxDropWidth    : null, // if null then auto set
                    minDropWidth    : null, // if null then auto set
                    match           : 'begins', // ['contains', 'is', 'begins', 'ends']
                    icon            : null,
                    iconStyle       : '',
                    align           : 'both', // same width as control
                    altRows         : true, // alternate row color
                    onSearch        : null, // when search needs to be performed
                    onRequest       : null, // when request is submitted
                    onLoad          : null, // when data is received
                    onError         : null, // when data fails to load due to server error or other failure modes
                    renderDrop      : null, // render function for drop down item
                    compare         : null, // compare function for filtering
                    filter          : true, // weather to filter at all
                    prefix          : '',
                    suffix          : '',
                    openOnFocus     : false, // if to show overlay onclick or when typing
                    markSearch      : false
                }
                if (typeof options.items == 'function') {
                    options._items_fun = options.items
                }
                // need to be first
                options.items = w2utils.normMenu.call(this, options.items)
                if (this.type === 'list') {
                    // defaults.search = (options.items && options.items.length >= 10 ? true : false);
                    defaults.openOnFocus = true
                    query(this.el).addClass('w2ui-select')
                    // if simple value - look it up
                    if (!w2utils.isPlainObject(options.selected) && Array.isArray(options.items)) {
                        options.items.forEach(item => {
                            if (item && item.id === options.selected) {
                                options.selected = w2utils.clone(item)
                            }
                        })
                    }
                    this.resize()
                }
                options = w2utils.extend({}, defaults, options)
                this.options = options
                if (!w2utils.isPlainObject(options.selected)) options.selected = {}
                this.selected = options.selected
                if (this.type === 'list') this.addSearch()
                this.addPrefix()
                this.addSuffix()
                this.refresh()
                query(this.el)
                    .attr('autocapitalize', 'off')
                    .attr('autocomplete', 'off')
                    .attr('autocorrect', 'off')
                    .attr('spellcheck', 'false')
                if (options.selected.text != null) {
                    query(this.el).val(options.selected.text)
                }
                break
            case 'enum':
                defaults = {
                    items           : [], // id, text, tooltip, icon
                    selected        : [],
                    max             : 0, // max number of selected items, 0 - unlimited
                    url             : null, // not implemented
                    recId           : null, // map retrieved data from url to id, can be string or function
                    recText         : null, // map retrieved data from url to text, can be string or function
                    interval        : 350, // number of ms to wait before sending server call on search
                    method          : null, // default comes from w2utils.settings.dataType
                    postData        : {},
                    minLength       : 1, // min number of chars when trigger search
                    cacheMax        : 250,
                    maxWidth        : 250, // max width for a single item
                    maxHeight       : 350, // max height for input control to grow
                    maxDropHeight   : 350, // max height for drop down menu
                    maxDropWidth    : null, // if null then auto set
                    match           : 'contains', // ['contains', 'is', 'begins', 'ends']
                    align           : 'both', // same width as control
                    altRows         : true, // alternate row color
                    openOnFocus     : false, // if to show overlay onclick or when typing
                    markSearch      : true,
                    renderDrop      : null, // render function for drop down item
                    renderItem      : null, // render selected item
                    compare         : null, // compare function for filtering
                    filter          : true, // alias for compare
                    style           : '', // style for container div
                    onSearch        : null, // when search needs to be performed
                    onRequest       : null, // when request is submitted
                    onLoad          : null, // when data is received
                    onError         : null, // when data fails to load due to server error or other failure modes
                    onClick         : null, // when an item is clicked
                    onAdd           : null, // when an item is added
                    onNew           : null, // when new item should be added
                    onRemove        : null, // when an item is removed
                    onMouseEnter    : null, // when an item is mouse over
                    onMouseLeave    : null, // when an item is mouse out
                    onScroll        : null // when div with selected items is scrolled
                }
                options  = w2utils.extend({}, defaults, options, { suffix: '' })
                if (typeof options.items == 'function') {
                    options._items_fun = options.items
                }
                options.items    = w2utils.normMenu.call(this, options.items)
                options.selected = w2utils.normMenu.call(this, options.selected)
                this.options     = options
                if (!Array.isArray(options.selected)) options.selected = []
                this.selected = options.selected
                this.addSuffix()
                this.addMultiSearch()
                this.resize()
                break
            case 'file':
                defaults     = {
                    selected      : [],
                    max           : 0,
                    maxSize       : 0, // max size of all files, 0 - unlimited
                    maxFileSize   : 0, // max size of a single file, 0 -unlimited
                    maxWidth      : 250, // max width for a single item
                    maxHeight     : 350, // max height for input control to grow
                    maxDropHeight : 350, // max height for drop down menu
                    maxDropWidth  : null, // if null then auto set
                    readContent   : true, // if true, it will readAsDataURL content of the file
                    silent        : true,
                    align         : 'both', // same width as control
                    altRows       : true, // alternate row color
                    renderItem    : null, // render selected item
                    style         : '', // style for container div
                    onClick       : null, // when an item is clicked
                    onAdd         : null, // when an item is added
                    onRemove      : null, // when an item is removed
                    onMouseEnter  : null, // when an item is mouse over
                    onMouseLeave  : null // when an item is mouse out
                }
                options = w2utils.extend({}, defaults, options)
                this.options = options
                if (!Array.isArray(options.selected)) options.selected = []
                this.selected = options.selected
                if (query(this.el).attr('placeholder') == null) {
                    query(this.el).attr('placeholder', w2utils.lang('Attach files by dragging and dropping or Click to Select'))
                }
                this.addMultiSearch()
                this.resize()
                break
        }
        // attach events
        query(this.el)
            .css('box-sizing', 'border-box')
            .addClass('w2field w2ui-input')
            .off('.w2field')
            .on('change.w2field',  (event) => { this.change(event) })
            .on('click.w2field',   (event) => { this.click(event) })
            .on('focus.w2field',   (event) => { this.focus(event) })
            .on('blur.w2field',    (event) => { this.blur(event) })
            .on('keydown.w2field', (event) => { this.keyDown(event) })
            .on('keyup.w2field',   (event) => { this.keyUp(event) })
        // format initial value
        this.change(new Event('change'))
    }
    get() {
        let ret
        if (['list', 'enum', 'file'].indexOf(this.type) !== -1) {
            ret = this.selected
        } else {
            ret = query(this.el).val()
        }
        return ret
    }
    set(val, append) {
        if (['list', 'enum', 'file'].indexOf(this.type) !== -1) {
            if (this.type !== 'list' && append) {
                if (!Array.isArray(this.selected)) this.selected = []
                this.selected.push(val)
                // update selected array in overlay
                let overlay = w2menu.get(this.el.id + '_menu')
                if (overlay) overlay.options.selected = this.selected
                query(this.el).trigger('input').trigger('change')
            } else {
                let it = (this.type === 'enum' ? [val] : val)
                this.selected = it
                query(this.el).trigger('input').trigger('change')
            }
            this.refresh()
        } else {
            query(this.el).val(val)
        }
    }
    setIndex(ind, append) {
        if (['list', 'enum'].indexOf(this.type) !== -1) {
            let items = this.options.items
            if (items && items[ind]) {
                if (this.type !== 'list' && append) {
                    if (Array.isArray(this.selected)) this.selected = []
                    this.selected.push(items[ind])
                    // update selected array in overlay
                    let overlay = w2menu.get(this.el.id + '_menu')
                    if (overlay) overlay.options.selected = this.selected
                    query(this.el).trigger('input').trigger('change')
                } else {
                    let it = (this.type === 'enum' ? [items[ind]] : items[ind])
                    this.selected.push(it)
                    // update selected array in overlay
                    let overlay = w2menu.get(this.el.id + '_menu')
                    if (overlay) overlay.options.selected = this.selected
                    query(this.el).trigger('input').trigger('change')
                }
                this.refresh()
                return true
            }
        }
        return false
    }
    refresh() {
        let options  = this.options
        let selected = this.selected
        let time     = (new Date()).getTime()
        let styles   = getComputedStyle(this.el)
        // enum
        if (this.type == 'list') {
            query(this.el).parent().css('white-space', 'nowrap') // needs this for arrow always to appear on the right side
            // hide focus and show text
            if (this.helpers.prefix) this.helpers.prefix.hide()
            if (!this.helpers.focus) return
            // if empty show no icon
            if (this.selected == null && options.icon) {
                options.prefix = `
                    <span class="w2ui-icon ${options.icon} "style="cursor: pointer; font-size: 14px;
                        display: inline-block; margin-top: -1px; color: #7F98AD; ${options.iconStyle}">
                    </span>`
                this.addPrefix()
            } else {
                options.prefix = ''
                this.addPrefix()
            }
            // focus helper
            let focus = query(this.helpers.focus).find('input')
            let icon = query(focus.get(0).previousElementSibling)
            focus.css({ outline: 'none' })
            if (focus.val() === '') {
                focus.css('opacity', 0)
                icon.css('opacity', 0)
                query(this.el).val(selected && selected.text != null ? w2utils.lang(selected.text) : '')
            } else {
                focus.css('opacity', 1)
                icon.css('opacity', 1)
                query(this.el).val('')
                setTimeout(() => {
                    if (this.helpers.prefix) this.helpers.prefix.hide()
                    if (options.icon) {
                        focus.css('margin-left', '17px')
                        query(this.helpers.focus).find('.w2ui-icon-search')
                            .addClass('show-search')
                    } else {
                        focus.css('margin-left', '0px')
                        query(this.helpers.focus).find('.w2ui-icon-search')
                            .removeClass('show-search')
                    }
                }, 1)
            }
            // if readonly or disabled
            if (query(this.el).prop('readonly') || query(this.el).prop('disabled')) {
                setTimeout(() => {
                    if (this.helpers.prefix) query(this.helpers.prefix).css('opacity', '0.6')
                    if (this.helpers.suffix) query(this.helpers.suffix).css('opacity', '0.6')
                }, 1)
            } else {
                setTimeout(() => {
                    if (this.helpers.prefix) query(this.helpers.prefix).css('opacity', '1')
                    if (this.helpers.suffix) query(this.helpers.suffix).css('opacity', '1')
                }, 1)
            }
        }
        if (['enum', 'file'].includes(this.type)) {
            let html = ''
            if (Array.isArray(selected)) {
                selected.forEach((it, ind) => {
                    html += `
                        <div class="li-item" index="${ind}" style="max-width: ${parseInt(options.maxWidth)}px; ${it.style ? it.style : ''}">
                        ${
                            typeof options.renderItem === 'function'
                            ? options.renderItem(it, ind, `<div class="w2ui-list-remove" index="${ind}">&#160;&#160;</div>`)
                            : `
                               ${it.icon ? `<span class="w2ui-icon ${it.icon}"></span>` : ''}
                               ${(this.type === 'enum' ? it.text : it.name) ?? it.id ?? it }
                               ${it.size ? `<span class="file-size"> - ${w2utils.formatSize(it.size)}</span>` : ''}
                               <div class="w2ui-list-remove" index="${ind}">&#160;&#160;</div>
                            `
                        }
                        </div>`
                })
            }
            let div = this.helpers.multi
            let ul  = div.find('.w2ui-multi-items')
            if (options.style) {
                div.attr('style', div.attr('style') + ';' + options.style)
            }
            query(this.el).css('z-index', '-1')
            if (query(this.el).prop('readonly') || query(this.el).prop('disabled')) {
                setTimeout(() => {
                    div[0].scrollTop = 0 // scroll to the top
                    div.addClass('w2ui-readonly')
                        .find('.li-item').css('opacity', '0.9')
                        .parent().find('.li-search').hide()
                        .find('input').prop('readonly', true)
                        .closest('.w2ui-multi-items')
                        .find('.w2ui-list-remove').hide()
                }, 1)
            } else {
                setTimeout(() => {
                    div.removeClass('w2ui-readonly')
                        .find('.li-item').css('opacity', '1')
                        .parent().find('.li-search').show()
                        .find('input').prop('readonly', false)
                        .closest('.w2ui-multi-items')
                        .find('.w2ui-list-remove').show()
                }, 1)
            }
            // clean
            if (selected?.length > 0) {
                query(this.el).attr('placeholder', '')
            }
            div.find('.w2ui-enum-placeholder').remove()
            ul.find('.li-item').remove()
            // add new list
            if (html !== '') {
                ul.prepend(html)
            } else if (query(this.el).attr('placeholder') != null && div.find('input').val() === '') {
                let style = w2utils.stripSpaces(`
                    padding-top: ${styles['padding-top']};
                    padding-left: ${styles['padding-left']};
                    box-sizing: ${styles['box-sizing']};
                    line-height: ${styles['line-height']};
                    font-size: ${styles['font-size']};
                    font-family: ${styles['font-family']};
                `)
                div.prepend(`<div class="w2ui-enum-placeholder" style="${style}">${query(this.el).attr('placeholder')}</div>`)
            }
            // ITEMS events
            div.off('.w2item')
                .on('scroll.w2item', (event) => {
                    let edata = this.trigger('scroll', { target: this.el, originalEvent: event })
                    if (edata.isCancelled === true) return
                    // hide tooltip if any
                    w2tooltip.hide(this.el.id + '_preview')
                    // event after
                    edata.finish()
                })
                .find('.li-item')
                .on('click.w2item', (event) => {
                    let target = query(event.target).closest('.li-item')
                    let index  = target.attr('index')
                    let item   = selected[index]
                    if (query(target).hasClass('li-search')) return
                    event.stopPropagation()
                    let edata
                    // default behavior
                    if (query(event.target).hasClass('w2ui-list-remove')) {
                        if (query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
                        // trigger event
                        edata = this.trigger('remove', { target: this.el, originalEvent: event, item })
                        if (edata.isCancelled === true) return
                        // default behavior
                        selected.splice(index, 1)
                        query(this.el).trigger('input').trigger('change')
                        query(event.target).remove()
                    } else {
                        // trigger event
                        edata = this.trigger('click', { target: this.el, originalEvent: event.originalEvent, item })
                        if (edata.isCancelled === true) return
                        // if file - show image preview
                        let preview = item.tooltip
                        if (this.type === 'file') {
                            if ((/image/i).test(item.type)) { // image
                                preview = `
                                    <div class="w2ui-file-preview">
                                        <img src="${(item.content ? 'data:'+ item.type +';base64,'+ item.content : '')}"
                                            style="max-width: 300px">
                                    </div>`
                            }
                            preview += `
                                <div class="w2ui-file-info">
                                    <div class="file-caption">${w2utils.lang('Name')}:</div>
                                    <div class="file-value">${item.name}</div>
                                    <div class="file-caption">${w2utils.lang('Size')}:</div>
                                    <div class="file-value">${w2utils.formatSize(item.size)}</div>
                                    <div class="file-caption">${w2utils.lang('Type')}:</div>
                                    <div class="file-value file-type">${item.type}</div>
                                    <div class="file-caption">${w2utils.lang('Modified')}:</div>
                                    <div class="file-value">${w2utils.date(item.modified)}</div>
                                </div>`
                        }
                        if (preview) {
                            let name = this.el.id + '_preview'
                            w2tooltip.show({
                                name,
                                anchor: target.get(0),
                                html: preview,
                                hideOn: ['doc-click'],
                                class: ''
                            })
                            .show((event) => {
                                let $img = query(`#w2overlay-${name} img`)
                                $img.on('load', function (event) {
                                    let w = this.clientWidth
                                    let h = this.clientHeight
                                    if (w < 300 & h < 300) return
                                    if (w >= h && w > 300) query(this).css('width', '300px')
                                    if (w < h && h > 300) query(this).css('height', '300px')
                                })
                                .on('error', function (event) {
                                    this.style.display = 'none'
                                })
                            })
                        }
                        edata.finish()
                    }
                })
                .on('mouseenter.w2item', (event) => {
                    let target = query(event.target).closest('.li-item')
                    if (query(target).hasClass('li-search')) return
                    let item = selected[query(event.target).attr('index')]
                    // trigger event
                    let edata = this.trigger('mouseEnter', { target: this.el, originalEvent: event, item })
                    if (edata.isCancelled === true) return
                    // event after
                    edata.finish()
                })
                .on('mouseleave.w2item', (event) => {
                    let target = query(event.target).closest('.li-item')
                    if (query(target).hasClass('li-search')) return
                    let item = selected[query(event.target).attr('index')]
                    // trigger event
                    let edata = this.trigger('mouseLeave', { target: this.el, originalEvent: event, item })
                    if (edata.isCancelled === true) return
                    // event after
                    edata.finish()
                })
            // update size for enum, hide for file
            if (this.type === 'enum') {
                let search = this.helpers.multi.find('input')
                search.css({ width: '15px' })
            } else {
                this.helpers.multi.find('.li-search').hide()
            }
            this.resize()
        }
        return (new Date()).getTime() - time
    }
    // resizing width of list, enum, file controls
    resize() {
        let width = this.el.clientWidth
        let height = this.el.clientHeight
        // if (this.tmp.current_width == width && height > 0) return
        let styles = getComputedStyle(this.el)
        let focus  = this.helpers.focus
        let multi  = this.helpers.multi
        let suffix = this.helpers.suffix
        let prefix = this.helpers.prefix
        // resize helpers
        if (focus) {
            query(focus).css('width', width)
        }
        if (multi) {
            query(multi).css('width', width - parseInt(styles['margin-left'], 10) - parseInt(styles['margin-right'], 10))
        }
        if (suffix) {
            this.options.suffix = `<div class="arrow-down" style="margin-top: ${((parseInt(styles['height']) - 6) / 2)}px;"></div>`
            this.addSuffix()
        }
        if (prefix) {
            this.addPrefix()
        }
        // enum or file
        if (['enum', 'file'].includes(this.type)) {
            let div = this.helpers.multi
            // adjust height
            query(this.el).css('height', 'auto')
            let cntHeight = query(div).find(':scope div.w2ui-multi-items').get(0).clientHeight + 5
            if (cntHeight < 20) cntHeight = 20
            if (cntHeight > this.options.maxHeight) cntHeight = this.options.maxHeight
            let inpHeight = w2utils.getSize(this.el, 'height') - 2
            if (inpHeight > cntHeight) cntHeight = inpHeight
            query(div).css({
                'height': cntHeight + 'px',
                overflow: (cntHeight == this.options.maxHeight ? 'auto' : 'hidden')
            })
            if (cntHeight < this.options.maxHeight) query(div).prop('scrollTop', 0)
            // min height
            let minHeight = parseInt(styles['min-height'])
            if (minHeight > cntHeight) {
                cntHeight = minHeight
                query(div).css('height', cntHeight + 'px')
            }
            query(this.el).css({ 'height': cntHeight + 'px' })
        }
        // remember width
        this.tmp.current_width = width
    }
    reset() {
        // restore paddings
        if (this.tmp != null) {
            query(this.el).css('height', 'auto')
            Array('padding-left', 'padding-right', 'background-color', 'border-color').forEach(prop => {
                if (this.tmp && this.tmp['old-'+ prop] != null) {
                    query(this.el).css(prop, this.tmp['old-' + prop])
                    delete this.tmp['old-' + prop]
                }
            })
            // remove resize watcher
            clearInterval(this.tmp.sizeTimer)
        }
        // remove events and (data)
        query(this.el)
            .val(this.clean(query(this.el).val()))
            .removeClass('w2field')
            .removeData() // removes all attached data
            .off('.w2field') // remove only events added by w2field
        // remove helpers
        Object.keys(this.helpers).forEach(key => {
            query(this.helpers[key]).remove()
        })
        this.helpers = {}
    }
    clean(val) {
        // issue #499
        if(typeof val === 'number'){
            return val
        }
        let options = this.options
        val = String(val).trim()
        // clean
        if (['int', 'float', 'money', 'currency', 'percent'].indexOf(this.type) !== -1) {
            if (typeof val === 'string') {
                if (options.autoFormat && ['money', 'currency'].indexOf(this.type) !== -1) val = String(val).replace(options.moneyRE, '')
                if (options.autoFormat && this.type === 'percent') val = String(val).replace(options.percentRE, '')
                if (options.autoFormat && ['int', 'float'].indexOf(this.type) !== -1) val = String(val).replace(options.numberRE, '')
                val = val.replace(/\s+/g, '').replace(w2utils.settings.groupSymbol, '').replace(w2utils.settings.decimalSymbol, '.')
            }
            if (val !== '' && w2utils.isFloat(val)) val = Number(val); else val = ''
        }
        return val
    }
    format(val) {
        let options = this.options
        // auto format numbers or money
        if (options.autoFormat && val !== '') {
            switch (this.type) {
                case 'money':
                case 'currency':
                    val = w2utils.formatNumber(val, options.currencyPrecision, options.groupSymbol)
                    if (val !== '') val = options.currencyPrefix + val + options.currencySuffix
                    break
                case 'percent':
                    val = w2utils.formatNumber(val, options.precision, options.groupSymbol)
                    if (val !== '') val += '%'
                    break
                case 'float':
                    val = w2utils.formatNumber(val, options.precision, options.groupSymbol)
                    break
                case 'int':
                    val = w2utils.formatNumber(val, 0, options.groupSymbol)
                    break
            }
        }
        return val
    }
    change(event) {
        // numeric
        if (['int', 'float', 'money', 'currency', 'percent'].indexOf(this.type) !== -1) {
            // check max/min
            let val = query(this.el).val()
            let new_val = this.format(this.clean(query(this.el).val()))
            // if was modified
            if (val !== '' && val != new_val) {
                query(this.el).val(new_val)
                // cancel event
                event.stopPropagation()
                event.preventDefault()
                return false
            }
        }
        // color
        if (this.type === 'color') {
            let color = query(this.el).val()
            if (color.substr(0, 3).toLowerCase() !== 'rgb') {
                color   = '#' + color
                let len = query(this.el).val().length
                if (len !== 8 && len !== 6 && len !== 3) color = ''
            }
            let next = query(this.el).get(0).nextElementSibling
            query(next).find('div').css('background-color', color)
            if (query(this.el).hasClass('has-focus')) {
                this.updateOverlay()
            }
        }
        // list, enum
        if (['list', 'enum', 'file'].indexOf(this.type) !== -1) {
            this.refresh()
            // need time out to show icon indent properly
            // TODO: check
            // setTimeout(() => { self.refresh() }, 5)
        }
        // date, time
        if (['date', 'time', 'datetime'].indexOf(this.type) !== -1) {
            // convert linux timestamps
            let tmp = parseInt(this.el.value)
            if (w2utils.isInt(this.el.value) && tmp > 3000) {
                if (this.type === 'time') tmp = w2utils.formatTime(new Date(tmp), this.options.format)
                if (this.type === 'date') tmp = w2utils.formatDate(new Date(tmp), this.options.format)
                if (this.type === 'datetime') tmp = w2utils.formatDateTime(new Date(tmp), this.options.format)
                query(this.el).val(tmp).trigger('input').trigger('change')
            }
        }
    }
    click(event) {
        // lists
        if (['list', 'combo', 'enum'].includes(this.type)) {
            if (!query(this.el).hasClass('has-focus')) {
                this.focus(event)
            }
            if (this.type == 'combo') {
                this.updateOverlay()
            }
        }
        // other fields with drops
        if (['date', 'time', 'datetime', 'color'].includes(this.type)) {
            this.updateOverlay()
        }
    }
    focus(event) {
        // color, date, time
        if (['color', 'date', 'time', 'datetime'].indexOf(this.type) !== -1) {
            if (query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
            this.updateOverlay()
        }
        // menu
        if (['list', 'combo', 'enum'].indexOf(this.type) !== -1) {
            if (query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
            // regenerate items
            if (typeof this.options._items_fun == 'function') {
                this.options.items = w2utils.normMenu.call(this, this.options._items_fun)
            }
            if (this.helpers.focus) {
                let input = query(this.helpers.focus).find('input').get(0)
                input.value = ''
                input.select()
            }
            if (this.type == 'enum') {
                // file control in particular need to receive focus after file select
                let search = query(this.el.previousElementSibling).find('.li-search input').get(0)
                if (document.activeElement !== search) {
                    search.focus()
                }
            }
            this.resize()
            // update overlay if needed
            if (this.options.openOnFocus !== false || query(this.el).hasClass('has-focus')) {
                this.updateOverlay()
            }
        }
        if (this.type == 'file') {
            let prev = query(this.el).get(0).previousElementSibling
            query(prev).addClass('has-focus')
        }
        query(this.el).addClass('has-focus')
    }
    blur(event) {
        let val = query(this.el).val().trim()
        query(this.el).removeClass('has-focus')
        if (['int', 'float', 'money', 'currency', 'percent'].indexOf(this.type) !== -1) {
            if (val !== '') {
                let newVal = val
                let error = ''
                if (!this.isStrValid(val)) {
                    newVal = ''
                } else {
                    let rVal = this.clean(val)
                    if (this.options.min != null && rVal < this.options.min) {
                        newVal = this.options.min
                        error = `Should be >= ${this.options.min}`
                    }
                    if (this.options.max != null && rVal > this.options.max) {
                        newVal = this.options.max
                        error = `Should be <= ${this.options.max}`
                    }
                }
                if (this.options.autoCorrect) {
                    query(this.el).val(newVal).trigger('input').trigger('change')
                    if (error) {
                        w2tooltip.show({
                            name: this.el.id + '_error',
                            anchor: this.el,
                            html: error
                        })
                        setTimeout(() => { w2tooltip.hide(this.el.id + '_error') }, 3000)
                    }
                }
            }
        }
        // date or time
        if (['date', 'time', 'datetime'].includes(this.type) && this.options.autoCorrect) {
            if (val !== '') {
                let check = this.type == 'date' ? w2utils.isDate :
                    (this.type == 'time' ? w2utils.isTime : w2utils.isDateTime)
                if (!w2date.inRange(this.el.value, this.options)
                        || !check.bind(w2utils)(this.el.value, this.options.format)) {
                    // if not in range or wrong value - clear it
                    query(this.el).val('').trigger('input').trigger('change')
                }
            }
        }
        // clear search input
        if (this.type === 'enum') {
            query(this.helpers.multi).find('input').val('').css('width', '15px')
        }
        if (this.type == 'file') {
            let prev = this.el.previousElementSibling
            query(prev).removeClass('has-focus')
        }
    }
    keyDown(event, extra) {
        let options = this.options
        let key     = event.keyCode || (extra && extra.keyCode)
        let cancel  = false
        let val, inc, daymil, dt, newValue, newDT
        // ignore wrong pressed key
        if (['int', 'float', 'money', 'currency', 'percent', 'hex', 'bin', 'color', 'alphanumeric'].includes(this.type)) {
            if (!event.metaKey && !event.ctrlKey && !event.altKey) {
                let ch = String.fromCharCode(event.keyCode)
                if (!this.isStrValid(ch, true) && // valid & is not arrows, dot, comma, etc kesy
                        ![9, 8, 13, 27, 37, 38, 39, 40, 46, 188, 190].includes(event.keyCode)) {
                    event.preventDefault()
                    if (event.stopPropagation) event.stopPropagation(); else event.cancelBubble = true
                    return false
                }
            }
        }
        // numeric
        if (['int', 'float', 'money', 'currency', 'percent'].includes(this.type)) {
            if (!options.keyboard || query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
            val = parseFloat(query(this.el).val().replace(options.moneyRE, '')) || 0
            inc = options.step
            if (event.ctrlKey || event.metaKey) inc = options.step * 10
            switch (key) {
                case 38: // up
                    if (event.shiftKey) break // no action if shift key is pressed
                    newValue = (val + inc <= options.max || options.max == null ? Number((val + inc).toFixed(12)) : options.max)
                    query(this.el).val(newValue).trigger('input').trigger('change')
                    cancel = true
                    break
                case 40: // down
                    if (event.shiftKey) break // no action if shift key is pressed
                    newValue = (val - inc >= options.min || options.min == null ? Number((val - inc).toFixed(12)) : options.min)
                    query(this.el).val(newValue).trigger('input').trigger('change')
                    cancel = true
                    break
            }
            if (cancel) {
                event.preventDefault()
                this.moveCaret2end()
            }
        }
        // date/datetime
        if (['date', 'datetime'].includes(this.type)) {
            if (!options.keyboard || query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
            let is = (this.type == 'date' ? w2utils.isDate : w2utils.isDateTime).bind(w2utils)
            let format = (this.type == 'date' ? w2utils.formatDate : w2utils.formatDateTime).bind(w2utils)
            daymil = 24*60*60*1000
            inc = 1
            if (event.ctrlKey || event.metaKey) inc = 10 // by month
            dt = is(query(this.el).val(), options.format, true)
            if (!dt) { dt = new Date(); daymil = 0 }
            switch (key) {
                case 38: // up
                    if (event.shiftKey) break // no action if shift key is pressed
                    if (inc == 10) {
                        dt.setMonth(dt.getMonth() + 1)
                    } else {
                        dt.setTime(dt.getTime() + daymil)
                    }
                    newDT = format(dt.getTime(), options.format)
                    query(this.el).val(newDT).trigger('input').trigger('change')
                    cancel = true
                    break
                case 40: // down
                    if (event.shiftKey) break // no action if shift key is pressed
                    if (inc == 10) {
                        dt.setMonth(dt.getMonth() - 1)
                    } else {
                        dt.setTime(dt.getTime() - daymil)
                    }
                    newDT = format(dt.getTime(), options.format)
                    query(this.el).val(newDT).trigger('input').trigger('change')
                    cancel = true
                    break
            }
            if (cancel) {
                event.preventDefault()
                this.moveCaret2end()
                this.updateOverlay()
            }
        }
        // time
        if (this.type === 'time') {
            if (!options.keyboard || query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
            inc = (event.ctrlKey || event.metaKey ? 60 : 1)
            val = query(this.el).val()
            let time = w2date.str2min(val) || w2date.str2min((new Date()).getHours() + ':' + ((new Date()).getMinutes() - 1))
            switch (key) {
                case 38: // up
                    if (event.shiftKey) break // no action if shift key is pressed
                    time  += inc
                    cancel = true
                    break
                case 40: // down
                    if (event.shiftKey) break // no action if shift key is pressed
                    time  -= inc
                    cancel = true
                    break
            }
            if (cancel) {
                event.preventDefault()
                query(this.el).val(w2date.min2str(time)).trigger('input').trigger('change')
                this.moveCaret2end()
            }
        }
        // list
        if (this.type == 'list') {
            switch(key) {
                case 8: // delete
                    this.selected = null
                    w2menu.hide(this.el.id + '_menu')
                    this.refresh()
                    break
                case 27: // escape
                    w2menu.hide(this.el.id + '_menu')
                    this.refresh()
                    break
            }
            this.updateOverlay()
        }
        // enum
        if (this.type == 'enum') {
            switch(key) {
                case 8: // delete
                    let search = this.helpers.multi.find('input')
                    if (search.val() == '') {
                        w2menu.hide(this.el.id + '_menu')
                        this.selected.pop()
                        // update selected array in overlay
                        let overlay = w2menu.get(this.el.id + '_menu')
                        if (overlay) overlay.options.selected = this.selected
                        this.refresh()
                    }
                    break
                case 27: // escape
                    w2menu.hide(this.el.id + '_menu')
                    this.refresh()
                    break
                default: {
                    let overlay = w2menu.get(this.el.id + '_menu')
                    if (!overlay && !overlay?.displayed) {
                        this.updateOverlay()
                    }
                }
            }
        }
    }
    keyUp(event) {
        if (this.type == 'list') {
            if (event.target.value === '') {
                query(this.el).attr('placeholder', this.tmp.pholder)
            } else {
                query(this.el).attr('placeholder', '')
            }
            if (event.keyCode == 13) {
                setTimeout(() => {
                    event.target.value = ''
                    w2menu.hide(this.el.id + '_menu')
                    this.refresh()
                }, 1)
            } else {
                this.updateOverlay()
            }
        }
        if (this.type == 'enum') {
            let search = this.helpers.multi.find('input')
            let styles = getComputedStyle(search.get(0))
            let width = w2utils.getStrWidth(search.val(),
                `font-family: ${styles['font-family']}; font-size: ${styles['font-size']};`)
            search.css({ width: (width + 15) + 'px' })
            this.resize()
        }
    }
    updateOverlay(indexOnly) {
        let options = this.options
        let params
        // color
        if (this.type === 'color') {
            if (query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
            w2color.show({
                name: this.el.id + '_color',
                anchor: this.el,
                transparent: options.transparent,
                advanced: options.advanced,
                color: this.el.value,
                liveUpdate: true
            })
            .select(event => {
                let color = event.detail.color
                query(this.el).val(color).trigger('input').trigger('change')
            })
            .liveUpdate(event => {
                let color = event.detail.color
                query(this.helpers.suffix).find(':scope > div').css('background-color', '#' + color)
            })
        }
        // list
        if (['list', 'combo', 'enum'].includes(this.type)) {
            let el = this.el
            let input = this.el
            if (this.type === 'enum') {
                el = this.helpers.multi.get(0)
                input = query(el).find('input').get(0)
            }
            if (this.type === 'list') {
                let sel = this.selected
                if (w2utils.isPlainObject(sel) && Object.keys(sel).length > 0) {
                    let ind = _findItem(options.items, sel.id)
                    if (ind.length > 0) {
                        options.index = ind
                    }
                    function _findItem(items, search, parents) {
                        let ids = []
                        if (!parents) parents = []
                        items.forEach((item, ind) => {
                            if (item.id === search) {
                                ids = parents.concat([ind])
                                options.index = [ind]
                            }
                            if (ids.length == 0 && item.items && item.items.length > 0) {
                                parents.push(ind)
                                ids = _findItem(item.items, search, parents)
                                parents.pop()
                            }
                        })
                        return ids
                    }
                }
                input = query(this.helpers.focus).find('input').get(0)
            }
            if (query(this.el).hasClass('has-focus')) {
                let msgNoItems = w2utils.lang('No matches')
                if (options.url != null && String(query(input).val()).length < options.minLength && this.tmp.emptySet !== true) {
                    msgNoItems = w2utils.lang('${count} letters or more...', { count: options.minLength })
                }
                if (options.url != null && query(input).val() === '' && this.tmp.emptySet !== true) {
                    msgNoItems = w2utils.lang(options.msgSearch || 'Type to search...')
                }
                // TODO: remote url
                // if (options.url == null && options.items.length === 0) msgNoItems = w2utils.lang('Empty list')
                // if (options.msgNoItems != null) {
                //     let eventData = {
                //         search: query(input).val(),
                //         options: w2utils.clone(options)
                //     }
                //     if (options.url) {
                //         eventData.remote = {
                //             url: options.url,
                //             empty: this.tmp.emptySet ? true : false,
                //             error: this.tmp.lastError,
                //             minLength: options.minLength
                //         }
                //     }
                //     msgNoItems = (typeof options.msgNoItems === 'function'
                //         ? options.msgNoItems(eventData)
                //         : options.msgNoItems)
                // }
                // if (this.tmp.lastError) {
                //     msgNoItems = this.tmp.lastError
                // }
                // if (msgNoItems) {
                //     msgNoItems = '<div class="no-matches" style="white-space: normal; line-height: 1.3">' + msgNoItems + '</div>'
                // }
                params = w2utils.extend({}, options, {
                    name: this.el.id + '_menu',
                    anchor: input,
                    selected: this.selected,
                    search: false,
                    render: options.renderDrop,
                    anchorClass: '',
                    maxHeight: options.maxDropHeight, // TODO: check
                    maxWidth: options.maxDropWidth,  // TODO: check
                    minWidth: options.minDropWidth,  // TODO: check
                    msgNoItems: msgNoItems,
                })
                w2menu.show(params)
                    .select(event => {
                        if (this.type != 'enum') {
                            this.selected = event.detail.item
                            query(input).val('')
                            query(this.el).val(this.selected.text).trigger('input').trigger('change')
                        } else {
                            let selected = this.selected
                            let newItem = event.detail?.item
                            if (newItem) {
                                // trigger event
                                let edata = this.trigger('add', { target: this.el, item: newItem, originalEvent: event })
                                if (edata.isCancelled === true) return
                                // default behavior
                                if (selected.length >= options.max && options.max > 0) selected.pop()
                                delete newItem.hidden
                                selected.push(newItem)
                                query(this.el).trigger('input').trigger('change')
                                query(this.helpers.multi).find('input').val('')
                                // updaet selected array in overlays
                                let overlay = w2menu.get(this.el.id + '_menu')
                                if (overlay) overlay.options.selected = this.selected
                                // event after
                                edata.finish()
                            }
                        }
                    })
            }
        }
        // date
        if (['date', 'time', 'datetime'].includes(this.type)) {
            if (query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
            w2date.show(w2utils.extend({
                name: this.el.id + '_date',
                anchor: this.el,
                value: this.el.value,
            }, this.options))
            .select(event => {
                let date = event.detail.date
                if (date != null) {
                    query(this.el).val(date).trigger('input').trigger('change')
                }
            })
        }
    }
    /*
    *  INTERNAL FUNCTIONS
    */
    isStrValid(ch, loose) {
        switch (this.type) {
            case 'int':
                if (loose && ['-', this.options.groupSymbol].indexOf(ch) !== -1) return true
                return w2utils.isInt(ch.replace(this.options.numberRE, ''))
            case 'percent':
                ch = ch.replace(/%/g, '')
            case 'float':
                if (loose && ['-', w2utils.settings.decimalSymbol, this.options.groupSymbol].indexOf(ch) !== -1) return true
                return w2utils.isFloat(ch.replace(this.options.numberRE, ''))
            case 'money':
            case 'currency':
                if (loose && ['-', this.options.decimalSymbol, this.options.groupSymbol, this.options.currencyPrefix, this.options.currencySuffix].indexOf(ch) !== -1) return true
                return w2utils.isFloat(ch.replace(this.options.moneyRE, ''))
            case 'bin':
                return w2utils.isBin(ch)
            case 'hex':
                return w2utils.isHex(ch)
            case 'alphanumeric':
                return w2utils.isAlphaNumeric(ch)
        }
        return true
    }
    addPrefix() {
        let helper
        let styles = getComputedStyle(this.el)
        if (this.tmp['old-padding-left'] == null) {
            this.tmp['old-padding-left'] = styles['padding-left']
        }
        // remove if already displayed
        if (this.helpers.prefix) query(this.helpers.prefix).remove()
        if (this.options.prefix !== '') {
            query(this.el).before(`<div class="w2ui-field-helper">${this.options.prefix}</div>`)
            helper = query(this.el).get(0).previousElementSibling
            query(helper)
                .css({
                    'color'          : styles['color'],
                    'font-family'    : styles['font-family'],
                    'font-size'      : styles['font-size'],
                    'padding-top'    : styles['padding-top'],
                    'padding-bottom' : styles['padding-bottom'],
                    'padding-left'   : this.tmp['old-padding-left'],
                    'padding-right'  : 0,
                    'margin-top'     : (parseInt(styles['margin-top'], 10) + 2) + 'px',
                    'margin-bottom'  : (parseInt(styles['margin-bottom'], 10) + 1) + 'px',
                    'margin-left'    : styles['margin-left'],
                    'margin-right'   : 0
                })
            // only if visible
            query(this.el).css('padding-left', helper.clientWidth + 'px')
            // remember helper
            this.helpers.prefix = helper
        }
    }
    addSuffix() {
        let helper
        let self = this
        let styles = getComputedStyle(this.el)
        if (this.tmp['old-padding-right'] == null) {
            this.tmp['old-padding-right'] = styles['padding-right']
        }
        let pr = parseInt(styles['padding-right'] || 0)
        if (this.options.arrows) {
            // remove if already displayed
            if (this.helpers.arrows) query(this.helpers.arrows).remove()
            // add fresh
            query(this.el).after(
                '<div class="w2ui-field-helper" style="border: 1px solid transparent">&#160;'+
                '    <div class="w2ui-field-up" type="up">'+
                '        <div class="arrow-up" type="up"></div>'+
                '    </div>'+
                '    <div class="w2ui-field-down" type="down">'+
                '        <div class="arrow-down" type="down"></div>'+
                '    </div>'+
                '</div>')
            helper = query(this.el).get(0).nextElementSibling
            query(helper).css({
                    'color'         : styles['color'],
                    'font-family'   : styles['font-family'],
                    'font-size'     : styles['font-size'],
                    'height'        : this.el.clientHeight + 'px',
                    'padding'       : 0,
                    'margin-top'    : (parseInt(styles['margin-top'], 10) + 1) + 'px',
                    'margin-bottom' : 0,
                    'border-left'   : '1px solid silver',
                    'width'         : '16px',
                    'transform'     : 'translateX(-100%)'
                })
                .on('mousedown', function(event) {
                    if (query(event.target).hasClass('arrow-up')) {
                        self.keyDown(event, { keyCode: 38 })
                    }
                    if (query(event.target).hasClass('arrow-down')) {
                        self.keyDown(event, { keyCode: 40 })
                    }
                })
            pr += helper.clientWidth // width of the control
            query(this.el).css('padding-right', pr + 'px')
            this.helpers.arrows = helper
        }
        if (this.options.suffix !== '') {
            // remove if already displayed
            if (this.helpers.suffix) query(this.helpers.suffix).remove()
            // add fresh
            query(this.el).after(`<div class="w2ui-field-helper">${this.options.suffix}</div>`)
            helper = query(this.el).get(0).nextElementSibling
            query(helper)
                .css({
                    'color'          : styles['color'],
                    'font-family'    : styles['font-family'],
                    'font-size'      : styles['font-size'],
                    'padding-top'    : styles['padding-top'],
                    'padding-bottom' : styles['padding-bottom'],
                    'padding-left'   : 0,
                    'padding-right'  : styles['padding-right'],
                    'margin-top'     : (parseInt(styles['margin-top'], 10) + 2) + 'px',
                    'margin-bottom'  : (parseInt(styles['margin-bottom'], 10) + 1) + 'px',
                    'transform'      : 'translateX(-100%)'
                })
            query(this.el).css('padding-right', helper.clientWidth + 'px')
            this.helpers.suffix = helper
        }
    }
    // Only used for list
    addSearch() {
        let width = 0 // 11 - show search icon, 0 do not show
        let pholder
        // clean up & init
        if (this.helpers.focus) query(this.helpers.focus).remove()
        // remember original tabindex
        let tabIndex = parseInt(query(this.el).attr('tabIndex'))
        if (!isNaN(tabIndex) && tabIndex !== -1) this.tmp['old-tabIndex'] = tabIndex
        if (this.tmp['old-tabIndex']) tabIndex = this.tmp['old-tabIndex']
        if (tabIndex == null || isNaN(tabIndex)) tabIndex = 0
        // if there is id, add to search with "_search"
        let searchId = ''
        if (query(this.el).attr('id') != null) {
            searchId = 'id="' + query(this.el).attr('id') + '_search"'
        }
        // build helper
        let html = `
            <div class="w2ui-field-helper">
                <span class="w2ui-icon w2ui-icon-search"></span>
                <input ${searchId} type="text" tabIndex="${tabIndex}" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"/>
            </div>`
        query(this.el).attr('tabindex', -1).before(html)
        let helper = query(this.el).get(0).previousElementSibling
        this.helpers.focus = helper
        let styles = getComputedStyle(this.el)
        query(helper).css({
                width           : this.el.clientWidth,
                'margin-top'    : styles['margin-top'],
                'margin-left'   : styles['margin-left'],
                'margin-bottom' : styles['margin-bottom'],
                'margin-right'  : styles['margin-right']
            })
            .find('input')
            .css({
                cursor   : 'default',
                width    : '100%',
                opacity  : 1,
                padding  : styles.padding,
                margin   : styles.margin,
                border   : '1px solid transparent',
                'background-color' : 'transparent'
            })
        // INPUT events
        query(helper).find('input')
            .off('.helper')
            .on('focus.helper', event => {
                this.tmp.pholder = query(this.el).attr('placeholder') ?? ''
                query(event.target).val('')
                query(this.el).trigger('focus')
                this.refresh()
                event.stopPropagation()
            })
            .on('blur.helper', event => {
                query(event.target).val('')
                query(this.el).trigger('blur')
                if (this.tmp.pholder != null) query(this.el).attr('placeholder', this.tmp.pholder)
                w2menu.hide(this.el.id + '_menu')
                event.stopPropagation()
            })
            .on('keydown.helper', event => {
                query(event.target).css('opacity', 1)
                this.el.value = ''
                this.keyDown(event)
            })
            .on('keyup.helper', event => {
                this.keyUp(event)
            })
        // MAIN div
        query(helper).on('click', event => {
            query(event.target).find('input').focus()
        })
        this.refresh()
    }
    // Used in enum/file
    addMultiSearch() {
        // clean up & init
        query(this.helpers.multi).remove()
        // build helper
        let html   = ''
        let styles = getComputedStyle(this.el)
        let margin = w2utils.stripSpaces(`
            margin-top: 0px;
            margin-bottom: 0px;
            margin-left: ${styles['margin-left']};
            margin-right: ${styles['margin-right']};
            width: ${(w2utils.getSize(this.el, 'width') - parseInt(styles['margin-left'], 10)
                                - parseInt(styles['margin-right'], 10))}px;
        `)
        // if there is id, add to search with "_search"
        let searchId = ''
        if (query(this.el).attr('id') != null) {
            searchId = `id="${query(this.el).attr('id')}_search"`
        }
        // remember original tabindex
        let tabIndex = parseInt(query(this.el).attr('tabIndex'))
        if (!isNaN(tabIndex) && tabIndex !== -1) this.tmp['old-tabIndex'] = tabIndex
        if (this.tmp['old-tabIndex']) tabIndex = this.tmp['old-tabIndex']
        if (tabIndex == null || isNaN(tabIndex)) tabIndex = 0
        if (this.type === 'enum') {
            html = `
            <div class="w2ui-field-helper w2ui-list" style="${margin}">
                <div class="w2ui-multi-items">
                    <div class="li-search">
                        <input ${searchId} type="text" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"
                            tabindex="${tabIndex}"
                            ${query(this.el).prop('readonly') ? 'readonly': '' }
                            ${query(this.el).prop('disabled') ? 'disabled': '' }>
                    </div>
                </div>
            </div>`
        }
        if (this.type === 'file') {
            html = `
            <div class="w2ui-field-helper w2ui-list" style="${margin}">
                <div class="w2ui-multi-file">
                    <input name="attachment" class="file-input" type="file" tabindex="-1"'
                        style="width: 100%; height: 100%; opacity: 0" title=""
                        ${this.options.max !== 1 ? 'multiple' : ''}
                        ${query(this.el).prop('readonly') ? 'readonly': ''}
                        ${query(this.el).prop('disabled') ? 'disabled': ''}
                        ${query(this.el).attr('accept') ? ' accept="'+ query(this.el).attr('accept') +'"': ''}>
                </div>
                <div class="w2ui-multi-items">
                    <div class="li-search" style="display: none">
                        <input ${searchId} type="text" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"
                            tabindex="${tabIndex}"
                            ${query(this.el).prop('readonly') ? 'readonly': '' }
                            ${query(this.el).prop('disabled') ? 'disabled': '' }>
                    </div>
                </div>
            </div>`
        }
        // old bg and border
        this.tmp['old-background-color'] = styles['background-color']
        this.tmp['old-border-color']     = styles['border-color']
        query(this.el)
            .before(html)
            .css({
                'border-color': 'transparent',
                'background-color': 'transparent'
            })
        let div = query(this.el.previousElementSibling)
        this.helpers.multi = div
        query(this.el).attr('tabindex', -1)
        // click anywhere on the field
        div.on('click', event => { this.focus(event) })
        // search field
        div.find('input:not(.file-input)')
            .on('click', event => { this.click(event) })
            .on('focus', event => { this.focus(event) })
            .on('blur', event => { this.blur(event) })
            .on('keydown', event => { this.keyDown(event) })
            .on('keyup', event => { this.keyUp(event) })
        // file input
        if (this.type === 'file') {
            div.find('input.file-input')
                .off('.drag')
                .on('click.drag', (event) => {
                    event.stopPropagation()
                    if (query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
                    this.focus(event)
                })
                .on('dragenter.drag', (event) => {
                    if (query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
                    div.addClass('w2ui-file-dragover')
                })
                .on('dragleave.drag', (event) => {
                    if (query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
                    div.removeClass('w2ui-file-dragover')
                })
                .on('drop.drag', (event) => {
                    if (query(this.el).prop('readonly') || query(this.el).prop('disabled')) return
                    div.removeClass('w2ui-file-dragover')
                    let files = Array.from(event.dataTransfer.files)
                    files.forEach(file => { this.addFile(file) })
                    this.focus(event)
                    // cancel to stop browser behaviour
                    event.preventDefault()
                    event.stopPropagation()
                })
                .on('dragover.drag', (event) => {
                    // cancel to stop browser behaviour
                    event.preventDefault()
                    event.stopPropagation()
                })
                .on('change.drag', (event) => {
                    if (typeof event.target.files !== 'undefined') {
                        Array.from(event.target.files).forEach(file => { this.addFile(file) })
                    }
                    this.focus(event)
                })
        }
        this.refresh()
    }
    addFile(file) {
        let options = this.options
        let selected = this.selected
        let newItem = {
            name     : file.name,
            type     : file.type,
            modified : file.lastModifiedDate,
            size     : file.size,
            content  : null,
            file     : file
        }
        let size = 0
        let cnt = 0
        let errors = []
        if (Array.isArray(selected)) {
            selected.forEach(item => {
                if (item.name == file.name && item.size == file.size) {
                    errors.push(w2utils.lang('The file "${name}" (${size}) is already added.', {
                        name: file.name, size: w2utils.formatSize(file.size) }))
                }
                size += item.size
                cnt++
            })
        }
        if (options.maxFileSize !== 0 && newItem.size > options.maxFileSize) {
            errors.push(w2utils.lang('Maximum file size is ${size}', { size: w2utils.formatSize(options.maxFileSize) }))
        }
        if (options.maxSize !== 0 && size + newItem.size > options.maxSize) {
            errors.push(w2utils.lang('Maximum total size is ${size}', { size: w2utils.formatSize(options.maxSize) }))
        }
        if (options.max !== 0 && cnt >= options.max) {
            errors.push(w2utils.lang('Maximum number of files is ${count}', { count: options.max }))
        }
        // trigger event
        let edata = this.trigger('add', { target: this.el, file: newItem, total: cnt, totalSize: size, errors })
        if (edata.isCancelled === true) return
        // if errors and not silent
        if (options.silent !== true && errors.length > 0) {
            w2tooltip.show(this.el, 'Errors: ' + errors.join('<br>'))
            console.log('ERRORS (while adding files): ', errors)
            return
        }
        // check params
        selected.push(newItem)
        // read file as base64
        if (typeof FileReader !== 'undefined' && options.readContent === true) {
            let reader = new FileReader()
            let self = this
            // need a closure
            reader.onload = (function onload() {
                return function closure(event) {
                    let fl = event.target.result
                    let ind = fl.indexOf(',')
                    newItem.content = fl.substr(ind + 1)
                    self.refresh()
                    query(self.el).trigger('input').trigger('change')
                    // event after
                    edata.finish()
                }
            })()
            reader.readAsDataURL(file)
        } else {
            this.refresh()
            query(this.el).trigger('input').trigger('change')
            edata.finish()
        }
    }
    // move cursror to end
    moveCaret2end() {
        setTimeout(() => {
            this.el.setSelectionRange(this.el.value.length, this.el.value.length)
        }, 0)
    }
}
export {
    w2ui, w2utils, query, w2locale, w2event, w2base,
    w2popup, w2alert, w2confirm, w2prompt, Dialog,
    w2tooltip, w2menu, w2color, w2date, Tooltip,
    w2toolbar, w2sidebar, w2tabs, w2layout, w2grid, w2form, w2field
}