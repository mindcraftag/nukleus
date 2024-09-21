<template>
  <div v-if="info">
    <div v-if="avatarOnly">
      <v-avatar :size="avatarSize" color="grey">
        <span v-if="!info.avatar">{{info.initials}}</span>
        <img v-else :src="info.avatar">
      </v-avatar>
    </div>
    <div class="d-flex flex-no-wrap" v-else>
      <v-avatar :size="avatarSize" color="grey">
        <span v-if="!info.avatar">{{info.initials}}</span>
        <img v-else :src="info.avatar">
      </v-avatar>
      <div class="text-bold ml-2 mt-1">{{info.name}}</div>
      <div class="text-grey ml-2 mt-1"><span v-if="!small">Created: </span>{{createdDate}}</div>
    </div>
  </div>
</template>
<script>

import moment from 'moment'

export default {

  props: {
    item: {
      type: Object,
      required: true
    },
    small: {
      type: Boolean,
      defaultValue: false
    },
    avatarOnly: {
      type: Boolean,
      defaultValue: false
    }
  },

  data: () => ({
    info: null
  }),

  computed: {
    createdDate() {
      return moment().to(moment(this.item.createdAt));
    },

    avatarSize() {
      return this.small ? "24px" : "40px";
    }
  },

  mounted() {
    this.load();
  },

  methods: {
    async load() {
      this.info = await this.$store.state.nkclient.resolveUserOrGroupInfoForItem(this.item);
    }
  }
};

</script>
