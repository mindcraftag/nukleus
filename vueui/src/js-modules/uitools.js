'use strict'
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH

// -------------------------------------------------------------
// Array extensions
// -------------------------------------------------------------
Array.prototype.pushAll = function (array) {
  for (const a of array) {
    this.push(a)
  }
}

Array.prototype.removeObject = function (object) {
  const index = this.indexOf(object)
  if (index > -1) {
    this.splice(index, 1)
    return true
  }
  return false
}

Array.prototype.getObject = function (object) {
  const index = this.indexOf(object)
  if (index > -1) {
    return this[index];
  }
}

Array.prototype.hasObject = function (object) {
  const index = this.indexOf(object)
  if (index > -1) {
    return true
  }
  return false
}

Array.prototype.pushIfNew = function (object) {
  const existing = this.getObject(object);
  if (!existing) {
    this.push(object);
    return object;
  }
  else
    return existing;
}

Array.prototype.removeByFilterFunc = function (func) {
  let removeCount = 0
  for (let i = 0; i < this.length; i++) {
    if (func(this[i])) {
      this.splice(i, 1)
      i--
      removeCount++
    }
  }
  return removeCount
}

Array.prototype.clone = function () {
  const clone = []
  for (const entry of this) {
    clone.push(entry)
  }
  return clone
}

// -------------------------------------------------------------
// String extensions
// -------------------------------------------------------------
String.prototype.wordWrap = function (m, b, c) {
  var i, j, l, s, r
  if (m < 1) return this
  for (i = -1, l = (r = this.split('\n')).length; ++i < l; r[i] += s)
    for (
      s = r[i], r[i] = '';
      s.length > m;
      r[i] += s.slice(0, j) + ((s = s.slice(j)).length ? b : '')
    )
      j =
        c == 2 || (j = s.slice(0, m + 1).match(/\S*(\s)?$/))[1]
          ? m
          : j.input.length - j[0].length ||
            (c == 1 && m) ||
            j.input.length + (j = s.slice(m).match(/^\S*/)).input.length
  return r.join('\n')
}

String.prototype.hashCode = function () {
  var hash = 0,
    i,
    chr
  if (this.length === 0) return hash
  for (i = 0; i < this.length; i++) {
    chr = this.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return 2147483648 + hash
}

String.prototype.toColor = function (saturation) {
  if (saturation === undefined) saturation = 1.0

  let c = this.hashCode()

  let r = c & 0xff
  let g = (c >> 8) & 0xff
  let b = (c >> 16) & 0xff

  let invSat = 255.0 * (1.0 - saturation)

  r = Math.floor(invSat + r * saturation)
  g = Math.floor(invSat + g * saturation)
  b = Math.floor(invSat + b * saturation)

  let rs = r.toString(16).padStart(2, '0')
  let gs = g.toString(16).padStart(2, '0')
  let bs = b.toString(16).padStart(2, '0')

  return `#${rs}${gs}${bs}`
}

export default {
  createGUID: function () {
    var S4 = function () {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
    }
    return (
      S4() +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      S4() +
      S4()
    )
  },

  getItemIcon: function (type) {
    switch (type) {
      // Item types
      // -------------------------------------
      case 'Animation':
        return ['fal', 'film']
      case 'Audio':
        return ['fal', 'file-audio']
      case 'Audio Collection':
        return ['fal', 'album-collection']
      case 'Archive':
        return ['fal', 'file-zip']
      case 'HDR Image':
      case 'Image':
        return ['fal', 'file-image']
      case 'Mesh':
        return ['fal', 'draw-polygon']
      case 'Material':
        return ['fal', 'bullseye']
      case 'Scene':
        return ['fal', 'image']
      case 'Video':
        return ['fal', 'file-video']
      case 'PDF':
        return ['fal', 'file-pdf']
      case 'Lightsource':
        return ['fal', 'lightbulb']
      case 'Camera':
        return ['fal', 'camera']
      case 'Pixel Shader':
      case 'Vertex Shader':
      case 'Background Shader':
        return ['fal', 'brush']
      case 'Script':
        return ['fal', 'code']
      case 'PostFX':
        return ['fal', 'hurricane']
      case 'Package':
        return ['fal', 'box-archive']
      case 'Composition':
        return ['fal', 'aperture']
      case 'Project':
        return ['fal', 'clipboard']
      case 'Particles':
        return ['fal', 'sparkles']
      case 'Behaviour':
        return ['fal', 'brain']
      case 'Font':
        return ['fal', 'font']
      case 'Gaussian Splats':
        return ['fal', 'splotch']
      case 'Dataset':
      case 'Variable Set':
        return ['fal', 'database']

      // Scenegraph types
      // -------------------------------------
      case 'Sphere':
      case 'Cone':
      case 'Cylinder':
      case 'Plane':
      case 'Ring':
      case 'Torus':
      case 'Box':
        return ['fal', 'cube']
      case 'Text':
        return ['fal', 'text']

      default:
        return ['fal', 'file']
    }
  },

  getItemColor: function (type, saturation, brightness) {
    const colors = {
      Scene: '#ff8080',
      Mesh: '#8080ff',
      Material: '#ff80ff',
      Image: '#ffff80',
      'HDR Image': '#ffff80',
      Script: '#80ff80',
      'Pixel Shader': '#80ffff',
      'Vertex Shader': '#80ffff',
      'Background Shader': '#80ffff',
    }

    const color = colors[type] || '#ffffff'
    return this.adjustColor(color, saturation, brightness)
  },

  /**
   * Adjusts saturation and brightness of a color in #rrggbb string format
   * @param color
   * @param saturation
   * @param brightness
   * @returns {`#${string}${string}${string}`}
   */
  adjustColor: function (color, saturation, brightness) {
    if (color.length !== 7 || color[0] !== '#')
      console.error('Color is invalid. Needs to have #rrggbb format: ', color)

    let r = parseInt(color.substring(1, 3), 16)
    let g = parseInt(color.substring(3, 5), 16)
    let b = parseInt(color.substring(5, 7), 16)

    let invSat = 255.0 * (1.0 - saturation)

    r = Math.floor((invSat + r * saturation) * brightness)
    g = Math.floor((invSat + g * saturation) * brightness)
    b = Math.floor((invSat + b * saturation) * brightness)

    let rs = r.toString(16).padStart(2, '0')
    let gs = g.toString(16).padStart(2, '0')
    let bs = b.toString(16).padStart(2, '0')

    return `#${rs}${gs}${bs}`
  },

  rgbToHexColor: function (r, g, b) {
    let rs = r.toString(16).padStart(2, '0')
    let gs = g.toString(16).padStart(2, '0')
    let bs = b.toString(16).padStart(2, '0')
    return `#${rs}${gs}${bs}`
  },

  rgbObjToHexColor: function (col) {
    return this.rgbToHexColor(col.r, col.g, col.b)
  },

  hexColorToRgbObj: function (str) {
    const r = parseInt(str.substr(1, 2), 16)
    const g = parseInt(str.substr(3, 2), 16)
    const b = parseInt(str.substr(5, 2), 16)
    return { r, g, b }
  },

  rgbToGrey: function (r, g, b) {
    return r * 0.4 + g * 0.5 + b * 0.1
  },

  observeResize: function(el, func, timeout) {

    timeout = timeout || 100;

    let width = el.clientWidth;
    let height = el.clientHeight;

    let interval = setInterval(() => {
      if (el.clientWidth !== width || el.clientHeight !== height) {
        width = el.clientWidth;
        height = el.clientHeight;
        func(el, width, height);
      }
    }, timeout);

    return () => {
      clearInterval(interval);
    }
  }

}
