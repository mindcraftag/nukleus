/**
 * plugins/vuetify.js
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";

// Composables
import { createVuetify } from "vuetify";
//import { aliases, mdi } from 'vuetify/iconsets/mdi'

// Labs components
import { VDataTable } from 'vuetify/labs/VDataTable'


// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  components: {
    VDataTable
  },
  /*icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    }
  },*/
  theme: {
    themes: {
      dark: {
        primary: '#404850',
        // "contrast" is the color with the highest contrast for the selected theme
        contrast: '#FFFFFF',
        secondary: '#424242',
        accent: '#708090',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FFC107',

        themeColor: '#303840',
        iconColor: '#708090',
        toolbarColor: '#303840',
        navbarColor: '#202830'
      },
      light: {
        primary: '#607080',
        contrast: '#000000',
        secondary: '#626262',
        accent: '#708090',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FFC107',

        themeColor: '#303840',
        iconColor: '#708090',
        toolbarColor: '#303840',
        navbarColor: '#202830'
      }
    },
    options: {
      customProperties: true,
    }
  }
});
