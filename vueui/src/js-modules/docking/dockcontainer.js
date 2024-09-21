'use strict'
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import DockPanel from './dockpanel'
import uitools from "../uitools"

export default class DockContainer {
  constructor(domElementParent) {
    if (!domElementParent)
      throw 'DockWidget DOM Element Parent is null!'

    this._id = uitools.createGUID()

    // Create our main DOM element
    // ------------------------------------------------------------------
    this.domElementParent = domElementParent
    this.domElement = document.createElement('div')
    this.domElement.classList.add('n-dock-container')
    //this.domElement.style.pointerEvents = 'none'
    this.domElementParent.appendChild(this.domElement)

    // Create overlay DOM element
    // ------------------------------------------------------------------
    this.domElementOverlay = document.createElement('canvas')
    this.domElementOverlay.classList.add('n-dock-overlay')
    this.domElementOverlay.style.position = 'absolute'
    this.domElementOverlay.style.zIndex = 1000
    this.domElementOverlay.style.display = 'none'
    this.domElementOverlay.style.pointerEvents = "auto"
    this.domElementOverlay.style.backgroundColor = 'rgba(0, 20, 40, 0.5)'
    this.domElement.appendChild(this.domElementOverlay)

    // Listen to drag and drop events
    // ------------------------------------------------------------------

    this.domElement.addEventListener('dragover', (ev) => {
      ev.preventDefault()
      this.dragOver(ev)
    })

    this.domElementOverlay.addEventListener('drop', (ev) => {
      ev.preventDefault()
      this.stopDragging(ev)
    })

    // Listen to any events that need to cancel drag and drop
    // ------------------------------------------------------------------
    this.domElementOverlay.addEventListener('mouseup', () => {
      this.cancelDragging()
    })
    this.domElementOverlay.addEventListener('mouseout', () => {
      this.cancelDragging()
    })

    // Create canvas drawing context
    // ------------------------------------------------------------------
    this.canvasCtx = this.domElementOverlay.getContext('2d')

    this.panel = null
    this.dragging = false
    this.stateStr = ''
    this.state = null
    this.originalState = null
    this.hotspots = []
  }

  getDomElement() {
    return this.domElement
  }

  restoreState(state, fallbackState) {
    if (!state || !state.widgets || !state.panels) return

    this.endFullscreen()

    if (!this.originalState) {
      this.originalState = this.state
    }

    let widgets = []
    this.extractAllWidgets(widgets)

    try {
      this._restoreState(widgets, state, null)
      this.state = state
    } catch (err) {
      this._restoreState(widgets, fallbackState, null)
      this.state = fallbackState
    }

    if (widgets.length !== 0 && state !== fallbackState) {
      console.log(
        'Not all widgets could be restored. Adding missing widgets and resetting to default view.'
      )

      for (const widget of widgets) {
        this.addWidget(widget, 'join', this.panel)
      }

      this.restoreState(fallbackState, fallbackState)
    }

    this.update()
  }

  _restoreState(widgets, stateNode, parentPanel, position, splitPercentage) {
    let firstWidget = true
    let panel = null
    let activeWidget = null

    if (!stateNode) return

    if (Array.isArray(stateNode.widgets)) {
      for (const widgetEntry of stateNode.widgets) {
        if (!widgetEntry.name) throw 'Invalid state: widget entry needs a name.'

        for (const widget of widgets) {
          if (widget.getName() === widgetEntry.name) {
            if (parentPanel && firstWidget) {
              panel = this.addWidget(
                widget,
                position,
                parentPanel,
                splitPercentage
              )
              firstWidget = false
            } else if (parentPanel && !firstWidget) {
              this.addWidget(widget, 'join', panel)
            } else {
              panel = this.addWidget(widget)
            }

            if (widgetEntry.active) {
              activeWidget = widget
            }

            widgets.removeByFilterFunc((w) => w._id === widget._id)
            break
          }
        }
      }
    }

    if (activeWidget) {
      activeWidget.activate()
    }

    if (Array.isArray(stateNode.panels) && panel) {
      for (const panelEntry of stateNode.panels) {
        this._restoreState(
          widgets,
          panelEntry.panel,
          panel,
          panelEntry.position,
          panelEntry.splitPercentage
        )
      }
    }
  }

  extractAllWidgets(widgets) {
    if (this.panel) {
      this.panel.extractAllWidgets(widgets)
      this.panel = null
    }
  }

  endFullscreen() {
    if (this.panel)
      this.panel.endFullscreen()
  }

  startFullscreen(panel) {
    if (this.panel)
      this.panel.startFullscreen(panel)
  }

  saveState() {
    if (this.panel) {
      const state = this.panel.saveState()
      const stateStr = JSON.stringify(state)
      if (this.stateStr !== stateStr) {
        this.stateStr = stateStr
        this.state = state
        if (typeof this.onstatechange === 'function') {
          this.onstatechange(state)
        }
      }
    } else {
      return null
    }
  }

  addWidget(widget, position, refWidget, splitPercentage) {
    let refPanel = refWidget instanceof DockPanel ? refWidget : null
    if (refWidget && !refPanel) {
      refPanel = this.getRefPanel(refWidget)
      if (!refPanel)
        throw 'Reference panel not found for widget:' + refWidget.getTitle()
    }

    if (!position) {
      const panel = new DockPanel(this)
      panel.addWidget(widget)
      this.panel = panel
      this.domElement.appendChild(panel.getDomElement())
      return panel
    } else if (position === 'join') {
      if (!refPanel)
        throw 'No reference panel to join with!'

      refPanel.addWidget(widget)
      return refPanel
    } else {
      if (!refPanel)
        throw 'No reference panel to split from!'

      const panel = new DockPanel(this)
      panel.addWidget(widget)
      refPanel.addSubPanel(this, panel, position, splitPercentage)
      this.domElement.appendChild(panel.getDomElement())
      return panel
    }
  }

  getRefPanel(widget) {
    if (this.panel) {
      const result = this.panel.getRefPanel(widget)
      if (result) return result
    }

    return null
  }

  getClientOffset() {
    const rect = this.domElement.getBoundingClientRect()
    return {
      x: rect.x,
      y: rect.y,
    }
  }

  getRect() {
    const rect = this.domElement.getBoundingClientRect()
    return {
      x: 0,
      y: 0,
      w: rect.width,
      h: rect.height,
      offX: rect.x,
      offY: rect.y,
    }
  }

  startDragging(widget) {
    this.setOverlayRect({ x: 0, y: 0, w: 10, h: 10 })
    this.dragging = true
    this.draggingWidget = widget
    this.draggingWidget.getTitleDomElement().style.zIndex = 2000
    this.domElementOverlay.style.display = 'block'
    this.calculateHotspots()
  }

  stopDragging(ev) {
    this.cancelDragging()

    if (this.activeHotspot && this.draggingWidget) {
      this.draggingWidget.removeFromPanel()
      this.addWidget(
        this.draggingWidget,
        this.activeHotspot.position,
        this.activeHotspot.panel,
        50
      )
      this.update()
    }
  }

  cancelDragging() {
    if (this.dragging) {
      this.dragging = false
      this.draggingWidget.getTitleDomElement().style.zIndex = 0
      this.domElementOverlay.style.display = 'none'
    }
  }

  dragOver(ev) {
    const rect = this.getRect()
    const mousePos = { x: ev.clientX - rect.offX, y: ev.clientY - rect.offY }
    this.setOverlayRect(rect)
    this.renderOverlay(mousePos)
  }

  setOverlayRect(rect) {
    this.domElementOverlay.style.width = `${rect.w}px`
    this.domElementOverlay.style.height = `${rect.h}px`
    this.domElementOverlay.width = rect.w
    this.domElementOverlay.height = rect.h
  }

  calculateHotspots() {
    this.hotspots = []
    this.activeHotspot = null

    if (this.panel) {
      this.panel.calculateHotspots(this.hotspots)
    }
  }

  renderRect(rect, color, dashes) {
    this.canvasCtx.beginPath()
    this.canvasCtx.rect(rect.x, rect.y, rect.w, rect.h)
    this.canvasCtx.lineWidth = 2
    this.canvasCtx.strokeStyle = color
    this.canvasCtx.setLineDash(dashes)
    this.canvasCtx.stroke()
  }

  isInRect(rect, mousePos) {
    return (
      mousePos.x >= rect.x &&
      mousePos.x < rect.x + rect.w &&
      mousePos.y >= rect.y &&
      mousePos.y < rect.y + rect.h
    )
  }

  renderOverlay(mousePos) {
    const rect = this.getRect()
    this.canvasCtx.clearRect(0, 0, rect.w, rect.h)

    if (this.panel) {
      this.panel.renderOverlay(this.canvasCtx)
    }

    for (const hotspot of this.hotspots) {
      if (this.isInRect(hotspot.rect, mousePos)) {
        this.renderRect(hotspot.rect, '#ffffff', [])
        this.activeHotspot = hotspot
        break
      }
    }
  }

  update() {
    const rect = this.getRect()
    this.canvasCtx.clearRect(0, 0, rect.w, rect.h)

    if (this.panel) {
      this.panel.update(rect)
      //this.logState()
    }

    this.saveState()
  }

  logState() {
    if (this.panel) {
      console.log(this.panel)
      this.panel.logState(0)
    }
  }
}
