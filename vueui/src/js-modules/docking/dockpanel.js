'use strict'
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import uitools from "../uitools";

const SPLITTER_WIDTH = 4

export default class DockPanel {
  constructor(container) {
    const _this = this

    if (!container)
      throw 'Container is null!'

    this._id = uitools.createGUID();
    this.container = container

    this.domElement = document.createElement('div')
    this.domElement.classList.add('n-dock-panel')
    this.domElement.style.position = 'absolute'

    this.domElementTitle = document.createElement('div')
    this.domElementTitle.classList.add('n-dock-panel-title')
    this.domElement.appendChild(this.domElementTitle)

    this.domElementFullscreenButton = document.createElement('div')
    this.domElementFullscreenButton.classList.add('n-dock-panel-fs-button')
    this.domElementFullscreenButton.style.float = 'right'
    this.domElementFullscreenButton.addEventListener('click', function () {
      if (_this.isFullscreen())
        _this.container.endFullscreen();
      else
        _this.container.startFullscreen(_this);
    })
    this.domElementTitle.appendChild(this.domElementFullscreenButton)

    this.domElementContent = document.createElement('div')
    this.domElementContent.classList.add('n-dock-panel-content')
    this.domElement.appendChild(this.domElementContent)

    this.fullscreenActive = false;
    this.isHidden = false;
    this.widgets = []
    this.subPanels = []
    this.rect = {}
  }

  getDomElement() {
    return this.domElement
  }

  getLeft() {
    return this.domElement.offsetLeft;
  }

  getTop() {
    return this.domElement.offsetTop;
  }

  getWidth() {
    return this.domElement.offsetWidth;
  }

  getHeight() {
    return this.domElement.offsetHeight;
  }

  hasWidget(widget) {
    for (const w of this.widgets) {
      if (w._id === widget._id)
        return true;
    }
    return false;
  }

  endFullscreen() {

    if (this.isFullscreen()) {
      this.toggleFullscreen();
    } else {
      this.show();
    }

    for (const panelEntry of this.subPanels) {
      panelEntry.splitter.style.display = "block";
      panelEntry.panel.endFullscreen();
    }
  }

  startFullscreen(panel) {
    let needToStayVisible = false;

    for (const panelEntry of this.subPanels) {
      panelEntry.splitter.style.display = "none";
      if (panelEntry.panel.startFullscreen(panel))
        needToStayVisible = true;
    }

    if (this._id === panel._id) {
      // This panel is supposed to be fullscreen, so make it so!
      if (!this.isFullscreen())
        this.toggleFullscreen();

      // also make sure it is visible
      this.show();

      // return true to tell the caller that we either were the one to be fullscreen or our child was.
      needToStayVisible = true;
    } else {
      // This panel is NOT supposed to be the one in fullscreen, so if it is, toggle it
      if (this.isFullscreen())
        this.toggleFullscreen();

      // also hide it if we do not contain the fullscreen panel
      if (!needToStayVisible)
        this.hide();
    }

    return needToStayVisible;
  }

  isFullscreen() {
    return this.fullscreenActive
  }

  hide() {
    this.isHidden = true;
    this.domElement.style.display = "none";
  }

  show() {
    this.isHidden = false;
    this.domElement.style.display = "flex";
  }

  toggleFullscreen() {
    if (this.fullscreenActive) {
      this.domElement.classList.remove('n-dock-panel-fullscreen')
      this.fullscreenActive = false
    } else {
      this.domElement.classList.add('n-dock-panel-fullscreen')
      this.fullscreenActive = true
    }
  }

  extractAllWidgets(widgets) {
    for (const panelEntry of this.subPanels) {
      panelEntry.panel.extractAllWidgets(widgets)
      this.container.getDomElement().removeChild(panelEntry.splitter)
    }

    this.subPanels = []

    for (const widget of this.widgets) {
      widgets.push(widget)
      this.domElementContent.removeChild(widget.getDomElement())
      this.domElementTitle.removeChild(widget.getTitleDomElement())
      widget.setPanel(null)
    }

    this.widgets = []

    this.container.getDomElement().removeChild(this.domElement)
  }

  saveState() {
    const widgets = []
    for (const widgetEntry of this.widgets) {
      widgets.push({
        name: widgetEntry.getName(),
        active: widgetEntry.isActive(),
      })
    }

    const panels = []
    for (const subPanel of this.subPanels) {
      panels.push({
        panel: subPanel.panel.saveState(),
        splitPercentage: subPanel.splitPercentage,
        position: subPanel.position,
      })
    }

    return {
      widgets: widgets,
      panels: panels,
    }
  }

  mergePanel(panel) {
    // we're merging the panel down to this one. That means this one needs to
    // be removed first
    this.container.getDomElement().removeChild(this.domElement)

    // now merge all data
    this.domElement = panel.domElement
    this.domElementTitle = panel.domElementTitle
    this.domElementContent = panel.domElementContent

    for (const widget of panel.widgets) {
      widget.setPanel(this)
      this.widgets.push(widget)
    }

    for (const panelEntry of panel.subPanels) {
      panelEntry.panel.setParentPanel(this)
      this.subPanels.push(panelEntry)
    }

    // update the container
    this.container.update()
  }

  setParentPanel(panel) {
    this.parentPanel = panel
  }

  remove() {
    // if we want to remove this panel, it should better be empty
    if (this.widgets.length === 0) {
      // check if we still have subpanels, if so, we are not able to remove it
      // but will move the last subpanels content here and instead remove that one.
      if (this.subPanels.length > 0) {
        const lastSubPanel = this.subPanels[this.subPanels.length - 1]
        this.subPanels.removeByFilterFunc((p) => p.panel._id === lastSubPanel.panel._id)
        this.container.getDomElement().removeChild(lastSubPanel.splitter)
        this.mergePanel(lastSubPanel.panel)
      } else {
        // we have no subpanels. So we can remove the panel safely
        if (this.parentPanel) {
          this.container.getDomElement().removeChild(this.domElement)
          this.parentPanel.removeSubPanel(this)
          this.container.update()
        }
      }
    } else {
      throw 'Cannot remove panel, it still has widgets!'
    }
  }

  removeSubPanel(panel) {
    for (const panelEntry of this.subPanels) {
      if (panelEntry.panel._id === panel._id) {
        this.container.getDomElement().removeChild(panelEntry.splitter)
        this.subPanels.removeByFilterFunc((p) => p.panel._id === panelEntry.panel._id)
        return
      }
    }
  }

  addSubPanel(container, panel, position, splitPercentage) {
    // Determine splitter direction and cursor
    // ------------------------------------------------------
    let cursor = ''
    let isVertical = false
    switch (position) {
      case 'bottom':
      case 'top':
        cursor = 'ns-resize'
        break
      case 'left':
      case 'right':
        cursor = 'ew-resize'
        isVertical = true
        break
    }

    // Create splitter
    // ------------------------------------------------------
    const splitter = document.createElement('div')
    splitter.classList.add('n-dock-panel-splitter')
    splitter.style.position = 'absolute'
    splitter.style.userSelect = 'none'
    splitter.style.cursor = cursor
    container.getDomElement().appendChild(splitter)

    // Create panel entry
    // ------------------------------------------------------
    let panelEntry = {
      panel: panel,
      position: position,
      splitPercentage: splitPercentage,
      splitter: splitter,
      rect: null,
    }
    this.subPanels.push(panelEntry)
    panel.setParentPanel(this)

    // Splitter event handling
    // ------------------------------------------------------
    const _this = this
    let mouseIsDown = false
    splitter.addEventListener('mousedown', function (event) {
      mouseIsDown = true
    })
    window.addEventListener('mouseup', function () {
      mouseIsDown = false
    })
    window.addEventListener('mousemove', function (event) {
      if (mouseIsDown) {
        const off = _this.container.getClientOffset()
        let pos

        if (isVertical) {
          pos = ((event.clientX - off.x - panelEntry.rect.x) / panelEntry.rect.w) * 100
        } else {
          pos = ((event.clientY - off.y - panelEntry.rect.y) / panelEntry.rect.h) * 100
        }

        if (pos < 5)
          pos = 5

        if (pos > 95)
          pos = 95

        panelEntry.splitPercentage = pos
        _this.container.update()
      }
    })
  }

  getRefPanel(widget) {
    if (this.hasWidget(widget)) return this

    for (const entry of this.subPanels) {
      const result = entry.panel.getRefPanel(widget)
      if (result) return result
    }

    return null
  }

  setPointerEvents(value) {
    this.domElement.style.pointerEvents = value ? 'auto' : 'none';
  }

  activateWidget(widget) {
    for (const childWidget of this.widgets) {
      childWidget.setActive(childWidget._id === widget._id)
    }
  }

  addWidget(widget) {
    widget.setPanel(this)
    this.widgets.push(widget)
    this.domElementContent.appendChild(widget.getDomElement())
    this.domElementTitle.appendChild(widget.getTitleDomElement())
    widget.setContainer(this.container)
    this.activateWidget(widget)
  }

  removeWidget(widget) {
    if (this.hasWidget(widget)) {
      this.domElementContent.removeChild(widget.getDomElement())
      this.domElementTitle.removeChild(widget.getTitleDomElement())
      this.widgets.removeByFilterFunc((w) => widget._id === w._id)
      widget.setPanel(null)

      if (this.widgets.length === 0) {
        this.remove()
      } else {
        this.activateWidget(this.widgets[0])
      }
    } else {
      throw 'Widget is not part of this panel!'
    }
  }

  setRect(rect) {
    this.rect = rect
    this.setElementRect(this.domElement, rect)
  }

  setElementRect(el, rect) {
    el.style.left = `${rect.x}px`
    el.style.top = `${rect.y}px`
    el.style.width = `${rect.w}px`
    el.style.height = `${rect.h}px`
  }

  renderRect(rect, ctx, color, dashes) {
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w, rect.h)
    ctx.lineWidth = 1
    ctx.strokeStyle = color
    ctx.setLineDash(dashes)
    ctx.stroke()
  }

  isPosInRect(pos, rect) {
    return (
      pos.x >= rect.x &&
      pos.x <= rect.x + rect.w &&
      pos.y >= rect.y &&
      pos.y <= rect.y + rect.h
    )
  }

  calculateHotspots(hotspots) {
    const x = this.rect.x + 2
    const y = this.rect.y + 26
    const w = this.rect.w - 4
    const h = this.rect.h - 28
    const w3 = w / 3
    const h3 = h / 3
    const w32 = w3 * 2
    const h32 = h3 * 2

    const topHotspot = { x: x, y: y, w: w, h: h3 }
    const bottomHotspot = { x: x, y: y + h32, w: w, h: h3 }
    const leftHotspot = { x: x, y: y, w: w3, h: h }
    const rightHotspot = { x: x + w32, y: y, w: w3, h: h }

    hotspots.push({
      rect: topHotspot,
      panel: this,
      position: 'top',
    })
    hotspots.push({
      rect: bottomHotspot,
      panel: this,
      position: 'bottom',
    })
    hotspots.push({
      rect: leftHotspot,
      panel: this,
      position: 'left',
    })
    hotspots.push({
      rect: rightHotspot,
      panel: this,
      position: 'right',
    })
    hotspots.push({
      rect: this.rect,
      panel: this,
      position: 'join',
    })

    for (const entry of this.subPanels) {
      entry.panel.calculateHotspots(hotspots)
    }
  }

  renderOverlay(ctx) {
    const rect = {
      x: this.rect.x + 2,
      y: this.rect.y + 2,
      w: this.rect.w - 4,
      h: this.rect.h - 4,
    }
    this.renderRect(rect, ctx, '#808080', [5, 3])

    for (const entry of this.subPanels) {
      entry.panel.renderOverlay(ctx)
    }
  }

  update(rect) {
    for (const entry of this.subPanels) {
      const splitPercentage = entry.splitPercentage || 50
      const splitPosition = entry.position
      const f = splitPercentage / 100
      const finv = 1 - f

      let newRect
      let splitterRect

      // save the original rect for later splitter modification
      entry.rect = {
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
      }

      switch (splitPosition) {
        case 'left':
          newRect = {
            x: rect.x,
            y: rect.y,
            w: rect.w * f - SPLITTER_WIDTH,
            h: rect.h,
          }
          splitterRect = {
            x: rect.x + newRect.w,
            y: rect.y,
            w: SPLITTER_WIDTH,
            h: rect.h,
          }
          rect.x += rect.w * f
          rect.w *= finv
          break

        case 'right':
          newRect = {
            x: rect.x + rect.w * f + SPLITTER_WIDTH,
            y: rect.y,
            w: rect.w * finv - SPLITTER_WIDTH,
            h: rect.h,
          }
          splitterRect = {
            x: newRect.x - SPLITTER_WIDTH,
            y: rect.y,
            w: SPLITTER_WIDTH,
            h: rect.h,
          }
          rect.w *= f
          break

        case 'top':
          newRect = {
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h * f - SPLITTER_WIDTH,
          }
          splitterRect = {
            x: rect.x,
            y: rect.y + newRect.h,
            w: rect.w,
            h: SPLITTER_WIDTH,
          }
          rect.y += rect.h * f
          rect.h *= finv
          break

        case 'bottom':
          newRect = {
            x: rect.x,
            y: rect.y + rect.h * f + SPLITTER_WIDTH,
            w: rect.w,
            h: rect.h * finv - SPLITTER_WIDTH,
          }
          splitterRect = {
            x: rect.x,
            y: newRect.y - SPLITTER_WIDTH,
            w: rect.w,
            h: SPLITTER_WIDTH,
          }
          rect.h *= f
          break
      }

      this.setElementRect(entry.splitter, splitterRect)
      entry.panel.update(newRect)
    }

    this.setRect(rect)
  }

  logState(level) {
    const indent = ''.padStart(level * 4, ' ')

    console.log(
      `${indent}- Panel (${this.rect.x}/${this.rect.y}/${this.rect.w}/${this.rect.h})`
    )

    for (const widget of this.widgets) {
      widget.logState(level + 1)
    }

    for (const subPanel of this.subPanels) {
      console.log(
        `${indent}# ${subPanel.position} @ ${subPanel.splitPercentage}`
      )
      subPanel.panel.logState(level + 1)
    }
  }
}
