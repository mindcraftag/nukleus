'use strict'
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import uitools from '../uitools'

export default class DockWidget {
  constructor(name, title, domElement, additionalCssClass, noPointerEvents) {
    const _this = this

    if (!domElement)
      throw 'DockWidget DOM Element Parent is null!'

    this._id = uitools.createGUID();
    this.childDomElement = domElement
    this.name = name
    this.title = title
    this.active = false
    this.noPointerEvents = noPointerEvents;
    this.onResize = null;

    this.domElement = document.createElement('div')
    this.domElement.classList.add('n-dock-widget')
    this.domElement.classList.add('n-scrollable')
    this.domElement.style.width = '100%'
    this.domElement.style.height = '100%'

    if (this.noPointerEvents)
      this.domElement.style.pointerEvents = 'none';

    this.domElement.appendChild(this.childDomElement)

    if (additionalCssClass) this.domElement.classList.add(additionalCssClass)

    this.titleDomElement = document.createElement('div')
    this.titleDomElement.classList.add('n-dock-panel-title-entry')
    this.titleDomElement.setAttribute('draggable', 'true')
    this.titleDomElement.style.float = 'left'
    this.titleDomElement.addEventListener('dragstart', function (ev) {
      if (_this.container) {
        _this.container.startDragging(_this)
      }
    })
    this.titleDomElement.addEventListener('click', function () {
      _this.activate()
    })

    const widgetTitleText = document.createTextNode(this.title)
    this.titleDomElement.appendChild(widgetTitleText)

    this.resizeObserver = new ResizeObserver(() => { _this.resized(); });
    this.resizeObserver.observe(this.domElement);
  }

  getName() {
    return this.name
  }

  resized() {
    if (this.onResize) {
      const x = this.getLeft();
      const y = this.getTop();
      const width = this.getWidth();
      const height = this.getHeight();
      this.onResize(x, y, width, height);
    }
  }

  getLeft() {
    return this.panel.getLeft();
  }

  getTop() {
    return this.panel.getTop() + this.domElement.offsetTop;
  }

  getWidth() {
    return this.domElement.offsetWidth;
  }

  getHeight() {
    return this.domElement.offsetHeight;
  }

  setPanel(panel) {
    this.panel = panel
  }

  activate() {
    if (this.panel) {
      this.panel.activateWidget(this)
    }
  }

  setActive(value) {
    this.active = value
    this.domElement.style.display = value ? 'block' : 'none'

    this.panel.setPointerEvents(!this.noPointerEvents);

    if (value)
      this.titleDomElement.classList.add('n-dock-panel-title-selected')
    else
      this.titleDomElement.classList.remove('n-dock-panel-title-selected')
  }

  removeFromPanel() {
    this.panel.removeWidget(this)
  }

  setContainer(container) {
    this.container = container
  }

  getTitleDomElement() {
    return this.titleDomElement
  }

  getTitle() {
    return this.title
  }

  isActive() {
    return this.active
  }

  getDomElement() {
    return this.domElement
  }

  logState(level) {
    const indent = ''.padStart(level * 4, ' ')
    console.log(`${indent}- Widget (${this.title})`)
  }
}
