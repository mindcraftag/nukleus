// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue';
import App from './App';
import router from './router';
import store from './store';
import Vuetify from 'vuetify';
import axios from 'axios'
import VueAxios from 'vue-axios'

import 'vuetify/dist/vuetify.min.css';
import '@mdi/font/css/materialdesignicons.css'
import '@mindcraftgmbh/nukleus-vueui/dist/vueui.css';
import './styles/global.css';

// Font Awesome
// --------------------------------------------------------------
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faFolder,
  faFile,
  faFileImage,
  faFileCode,
  faFileVideo,
  faFileWord,
  faFilePowerpoint,
  faFilePdf,
  faFileAudio,
  faFileArchive,
  faFileExcel,
  faFileCsv,
  faDrawPolygon,
  faBullseye,
  faDraftingCompass,
  faGlobe,
  faEdit,
  faTrash,
  faEye,
  faDownload,
  faSearchPlus,
  faSearchMinus,
  faMagic,
  faRedo,
  faSave,
  faMinusSquare,
  faPlusSquare,
  faImage,
  faLightbulb,
  faCamera,
  faCode,
  faArrowsAlt,
  faSyncAlt,
  faExpandAlt,
  faBorderAll,
  faArrowsAltV,
  faArrowUp,
  faArrowRight,
  faArrowLeft,
  faArrowDown,
  faChevronDown,
  faChevronRight,
  faPlay,
  faStop,
  faBrush,
  faCube,
  faText,
  faList,
  faUser,
  faUsers,
  faSearch,
  faServer,
  faDatabase,
  faTasks,
  faUserCircle,
  faChartLine,
  faSignIn,
  faSignOut,
  faChevronSquareLeft,
  faPersonDolly,
  faCameraRetro,
  faCopy,
  faBuilding,
  faThumbsUp,
  faTimes,
  faEllipsisH,
  faPlus,
  faMinus,
  faMoneyCheckAlt,
  faCheck,
  faCaretUp,
  faCaretDown,
  faPause,
  faInfoCircle,
  faOption
} from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
library.add(
  faFolder,
  faFile,
  faFileImage,
  faFileCode,
  faFileVideo,
  faFileWord,
  faFilePowerpoint,
  faFilePdf,
  faFileAudio,
  faFileArchive,
  faFileExcel,
  faFileCsv,
  faDrawPolygon,
  faBullseye,
  faDraftingCompass,
  faGlobe,
  faEdit,
  faTrash,
  faEye,
  faDownload,
  faSearchPlus,
  faSearchMinus,
  faMagic,
  faRedo,
  faSave,
  faMinusSquare,
  faPlusSquare,
  faImage,
  faLightbulb,
  faCamera,
  faCode,
  faArrowsAlt,
  faSyncAlt,
  faExpandAlt,
  faBorderAll,
  faArrowsAltV,
  faArrowUp,
  faArrowRight,
  faArrowLeft,
  faArrowDown,
  faChevronDown,
  faChevronRight,
  faPlay,
  faStop,
  faBrush,
  faText,
  faCube,
  faList,
  faUser,
  faUsers,
  faSearch,
  faServer,
  faDatabase,
  faTasks,
  faUserCircle,
  faChartLine,
  faSignIn,
  faSignOut,
  faChevronSquareLeft,
  faPersonDolly,
  faCameraRetro,
  faCopy,
  faBuilding,
  faThumbsUp,
  faTimes,
  faEllipsisH,
  faPlus,
  faMinus,
  faMoneyCheckAlt,
  faCheck,
  faCaretUp,
  faCaretDown,
  faPause,
  faInfoCircle,
  faOption
);
Vue.component('font-awesome-icon', FontAwesomeIcon);

// Register this editor component here because it will be used recursively
import DataTypeEditor from "./components/datatypeEditor/DataTypeEditor";
Vue.component('DataTypeEditor', DataTypeEditor);

const vuetify = new Vuetify({
  theme: {
    themes: {
      dark: {
        primary: '#404850',
        secondary: '#424242',
        accent: '#708090',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FFC107'
      },
      light: {
        primary: '#607080',
        secondary: '#626262',
        accent: '#708090',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FFC107'
      }
    },
    options: {
      customProperties: true,
    }
  }
});

Vue.use(VueAxios, axios);
Vue.use(Vuetify);
Vue.config.productionTip = false;

export { vuetify }

new Vue({
  el: '#app',
  vuetify: vuetify,
  store,
  router,
  components: { App },
  template: '<App/>',
  data: {
    themeColor: '#303840',
    iconColor: '#708090',
    toolbarColor: '#303840',
    navbarColor: '#202830'
  }
});
