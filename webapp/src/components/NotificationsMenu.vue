<template>
  <v-badge
    color="red"
    offset-x="20"
    offset-y="16"
    :value="notificationBadgeCount"
    :content="notificationBadgeCount"
  >
    <v-menu transition="v-menu-transition">
      <template #activator="{ props }">
        <v-btn variant="text" v-bind="props" @click="markAllAsRead">
          <font-awesome-icon
            v-if="notificationBadgeCount === 0"
            :icon="['fal', 'bell']"
            size="lg"
          />
          <font-awesome-icon v-else :icon="['fal', 'bell-on']" size="lg" />
        </v-btn>
      </template>
      <v-list lines="two">
        <div v-if="notifications.length === 0">
          <v-list-item>
            <v-list-item-title>No notifications available</v-list-item-title>
          </v-list-item>
        </div>
        <template v-for="notification in notifications" :key="notification._id">
          <v-divider></v-divider>
          <v-list-item>
            <v-list-item-title
              >{{ notification.text }}
              {{ notification.createdAt | formatDate }}</v-list-item-title
            >
            <v-list-item-subtitle>
              <div v-for="obj in notification.attachedObjects" :key="obj._id">
                <span v-if="!obj.exists">
                  {{ obj.name }}
                  <span
                    v-if="obj.autoDestructAt"
                    style="color: red; margin-left: 10px"
                  >
                    File deleted!
                  </span>
                </span>
                <span v-else>
                  <v-btn variant="text" @click="downloadItem(obj._id)">
                    Download {{ obj.name }}
                  </v-btn>
                  <span
                    v-if="obj.autoDestructAt"
                    style="color: red; margin-left: 10px"
                  >
                    Will destruct:
                    {{ obj.autoDestructAt | formatAutoDestruct }}
                  </span>
                </span>
              </div>
            </v-list-item-subtitle>
          </v-list-item>
        </template>
        <!--v-list-item
          ripple="ripple"
          @click="goToNotifications()">
          <v-list-item-content>
            <v-list-item-subtitle>Show all notifications</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item-->
      </v-list>
    </v-menu>
  </v-badge>
</template>
<script>
import moment from "moment";

export default {
  filters: {
    formatAutoDestruct: function (value) {
      const destructAt = moment(value);
      const now = moment();
      if (destructAt.isBefore(now)) {
        return "Any moment";
      }
      return now.to(destructAt);
    },
    formatDate: function (value) {
      return moment(value).format("YYYY-MM-DD hh:mm:ss");
    },
  },
  data: () => ({
    notifications: [],
  }),

  computed: {
    itemBaseUrl() {
      return this.$store.state.nkclient.getApiBaseUrl() + "/api/item/download/";
    },
    notificationBadgeCount: {
      get: function () {
        let count = 0;
        for (const notification of this.notifications) {
          if (!notification.readAt) count++;
        }
        return count;
      },
    },
  },

  created() {
    const _this = this;
    const eventBus = this.$store.state.nkclient.eventBus;

    eventBus.$on("activeClientNameUpdate", (event) => {
      _this.update();
    });

    eventBus.$on("clientUpdate", (event) => {
      _this.update();
    });

    eventBus.$on("permissionsUpdate", (event) => {
      _this.update();
    });

    eventBus.$on("nk:client:elementUpdate", (event) => {
      switch (event.type) {
        case "Notification":
          _this.update();
          break;
      }
    });
  },

  methods: {
    async downloadItem(itemId) {
      const link =
        await this.$store.state.nkclient.requestSecureDownload(itemId);
      window.location = link;
    },
    goToNotifications() {},
    async markAllAsRead() {
      try {
        let existsUnread = false;
        for (const notification of this.notifications) {
          if (!notification.readAt) {
            this.$set(notification, "readAt", new Date());
            existsUnread = true;
          }
        }

        if (existsUnread)
          await this.$store.state.nkclient.markAllNotificationsAsRead();
      } catch (err) {
        console.log(err);
        this.$store.commit("setError", err.toString());
      }
    },
    async update() {
      try {
        this.notifications =
          await this.$store.state.nkclient.getMyNotifications(10);
      } catch (err) {
        console.log(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>
