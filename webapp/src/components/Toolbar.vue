<template>
  <div>
    <v-app-bar
      theme="dark"
      data-test="appBar"
      scroll-behavior="elevate"
      :color="$vuetify.theme.current.toolbarColor"
      extension-height="0"
      height="64"
    >
      <v-app-bar-nav-icon @click="toggleNavigationBar"></v-app-bar-nav-icon>

      <div class="activeClientLabel">
        {{ activeClientName }}
        <font-awesome-icon
          v-if="$store.state.activeClientPublicDownloadAllowed"
          color="#0080f0"
          :icon="['fal', 'globe']"
        />
      </div>

      <v-spacer></v-spacer>

      <v-form @submit="search" style="min-width: 200px">
         <v-text-field
          v-model="searchQuery"
          class="toolbarControl"
          label="Search"
          placeholder="Search..."
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-cloud-search"
        ></v-text-field>
      </v-form>

      <v-snackbar
        v-model="showError"
        :timeout="4000"
        color="error"
        location="top"
      >
        {{ error }}
      </v-snackbar>

      <v-snackbar
        v-model="showMessage"
        :timeout="4000"
        color="success"
        location="top"
      >
        {{ message }}
      </v-snackbar>

      <JobDisplay
        id="jobDisplay"
        data-test="jobDisplay"
        style="width: 160px"
      ></JobDisplay>

      <v-menu
        v-if="jobs.length > 0"
        origin="center center"
        transition="v-menu-transition"
      >
        <template #activator="{ on }">
          <v-btn icon size="large" variant="text" :ripple="false" v-on="on">
            <v-badge location="right">
              <template #badge>
                <span v-if="jobBadgeCount > 0">{{ jobBadgeCount }}</span>
              </template>
              <v-icon>settings</v-icon>
            </v-badge>
          </v-btn>
        </template>
        <v-list lines="two">
          <v-list-subheader>Jobs</v-list-subheader>
          <template v-for="job in jobs" :key="job._id">
            <v-divider></v-divider>
            <v-list-item ripple="ripple" @click="goToJob(job)">
              <v-list-item avatar>
                <v-icon :style="stateColor(job.state)">{{ stateIcon(job.state) }}</v-icon>
              </v-list-item>

              <v-list-item-title
                >{{ job.type }} -
                {{ job.elementCount }} Element(s)</v-list-item-title
              >
              <v-list-item-subtitle
                >Created: {{ formatDate(job.createdAt) }}<br />{{
                  formatState(job.state)
                }}</v-list-item-subtitle
              >
            </v-list-item>
          </template>
          <v-list-item ripple="ripple" @click="goToJobs()">
            <v-list-item avatar> </v-list-item>

            <v-list-item-title>Show all jobs</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <NotificationsMenu></NotificationsMenu>

      <v-menu open-on-hover
              location="bottom">
        <template #activator="{ props }">
          <v-btn data-test="userMenu" variant="text" :ripple="false" v-bind="props">
            {{ myName }}&nbsp;<Avatar
              v-if="myUserId !== null"
              :size="32"
              :user-id="myUserId"
            ></Avatar>
          </v-btn>
        </template>
        <v-list>
          <v-list-item
            v-for="(item, index) in visibleItems"
            :key="index"
            ripple="ripple"
            :title="item.title"
            @click="item.click"
          >
            <template v-slot:prepend>
              <font-awesome-icon :icon="item.icon" style="margin-right: 4px" />
            </template>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-progress-linear
        v-if="showProgressIndicator"
        :indeterminate="progressIndeterminate"
        absolute
        bottom
        width="2"
        color="#e7eFcF"
      ></v-progress-linear>
    </v-app-bar>

    <UpdateDialog />
    <Uploader />
  </div>
</template>

<script>
import JobDisplay from "./JobDisplay.vue";
import NotificationsMenu from "./NotificationsMenu";
import Avatar from "./Avatar";

import moment from "moment";
import permissions from "../modules/permissions.js";

import { UpdateDialog, Uploader } from "@mindcraftgmbh/nukleus-vueui";

export default {
  components: {
    NotificationsMenu,
    JobDisplay,
    Uploader,
    UpdateDialog,
    Avatar,
  },

  // --------------------------------------------------------
  //  DATA
  // --------------------------------------------------------
  data() {
    return {
      activeClientName: "",
      items: [
        {
          icon: ["fal", "user"],
          title: "My Profile",
          click: () => {
            const vm = this;
            vm.$router.push({ name: "MyProfile" });
          },
        },
        {
          icon: ["fal", "building"],
          title: "My Space",
          visible: () => {
            return permissions.isAdmin();
          },
          click: () => {
            const vm = this;
            vm.$router.push({ name: "MySpace" });
          },
        },
        {
          icon: ["fal", "sign-out"],
          title: "Log Out",
          click: () => {
            const vm = this;
            vm.$store.commit("setAuthenticated", false, "");
            vm.$router.push({ name: "Login" });
          },
        },
      ],
      jobs: [],
      showProgressIndicator: false,
      progressPercent: null,
      progressIndeterminate: true,
      searchQuery: null,
    };
  },

  // --------------------------------------------------------
  //  COMPUTED
  // --------------------------------------------------------
  computed: {
    visibleItems() {
      return this.items.filter(item => !item.visible || item.visible());
    },
    showError: {
      get: function () {
        return this.error != null && this.error.length > 0;
      },
      set: function (value) {
        if (value === false) {
          this.$store.state.error = null;
        }
      },
    },
    error: {
      get: function () {
        return this.$store.state.error;
      },
    },
    showMessage: {
      get: function () {
        return this.message != null && this.message.length > 0;
      },
      set: function (value) {
        if (value === false) {
          this.$store.state.message = null;
        }
      },
    },
    message: {
      get: function () {
        return this.$store.state.message;
      },
    },
    jobBadgeCount: {
      get: function () {
        let count = 0;
        for (const job of this.jobs) {
          const createdAt = moment(job.createdAt);
          const diff = moment().diff(createdAt, "minutes");
          if (diff < 60) {
            count++;
          }
        }
        return count;
      },
    },
    myName() {
      const me = this.$store.state.me;

      if (me) {
        return me.name;
      }

      return "";
    },
    myUserId() {
      const me = this.$store.state.me;

      if (me) {
        return me._id;
      }

      return null;
    },
  },

  // --------------------------------------------------------
  //  CREATED
  // --------------------------------------------------------
  created() {
    const _this = this;

    this.$store.state.nkclient.$on("progress", function (data) {
      _this.updateProgress(data.type, data.percent);
    });

    this.$store.state.nkclient.eventBus.$on("activeClientNameUpdate", () => {
      _this.updateActiveClientName();
    });

    this.updateActiveClientName();
  },

  // --------------------------------------------------------
  //  METHODS
  // --------------------------------------------------------
  methods: {
    formatDate(value) {
      return moment(value).format("YYYY-MM-DD hh:mm:ss");
    },
    formatState(value) {
      switch (value) {
        case 0:
          return "Pending";
        case 1:
          return "Running";
        case 2:
          return "Failed";
        case 3:
          return "Succeeded";
        default:
          return "Unknown state";
      }
    },
    stateIcon(value) {
      switch (value) {
        case 0:
          return "settings";
        case 1:
          return "settings";
        case 2:
          return "error";
        case 3:
          return "done";
        default:
          return "Unknown state";
      }
    },
    stateColor(value) {
      switch (value) {
        case 0:
          return "color: grey";
        case 1:
          return "color: black";
        case 2:
          return "color: red";
        case 3:
          return "color: green";
        default:
          return "";
      }
    },
    search() {
      const q = this.searchQuery.trim();
      this.searchQuery = null;
      if (q.length) {
        this.$router.push("/query/" + q);
      }
    },

    hasPermission(perm, needsSuperadmin) {
      return permissions.hasPermission(perm, needsSuperadmin);
    },

    updateProgress(type, _ /* percent */) {
      this.showProgressIndicator = type === "upload" || type === "download";
      //this.progressPercent = (percent >= 0 || percent <= 100) ? percent : null;
      this.progressIndeterminate = true; //this.progressPercent == null;
    },

    toggleNavigationBar() {
      const vm = this;
      vm.$emit("toggleNavigationBar");
    },

    goToJobs() {
      this.$router.push({ name: "Jobs" });
    },

    goToJob(job) {
      this.$router.push({ name: "Jobs", params: { id: job._id } });
    },

    updateActiveClientName() {
      this.activeClientName = this.$store.state.activeClientName;
    },
  },
};
</script>

<style>
.v-toolbar__extension {
  padding: 0px !important;
}

.toolbarControl {
  margin-top: 30px !important;
  max-width: 300px !important;
}

.activeClientLabel {
  font-size: 18px;
  font-weight: bold;
}
</style>
