<template>
  <div>
    <table
      v-for="group in permissionGroups"
      :key="group.name"
      style="width: 100%"
    >
      <tr v-for="p in group.permissions" :key="p._id">
        <td class="fieldName70">
          {{ p.description }}
        </td>
        <td class="fieldValue">
          <div class="fieldValueContainer">
            <SmallCheckbox
              v-model="p.checked"
              :readonly="p.readonly"
              :color="p.readonly ? 'grey' : 'blue'"
              @update:model-value="valueUpdated"
            ></SmallCheckbox>
          </div>
        </td>
      </tr>
    </table>
  </div>
</template>
<script>

import { SmallCheckbox } from "@mindcraftgmbh/nukleus-vueui";
import permissions from "../modules/permissions.js";

export default {

  components: {
    SmallCheckbox
  },

  props: {
    modelValue: {
      type: Array,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
  },

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    permissionGroups: {
      get() {
        const permissionGroups = [];
        const groupNames = [];

        const permissionsList = [...this.modelValue];
        permissionsList.sort(function (a, b) {
          return a.description.localeCompare(b.description);
        });

        for (const p of permissionsList) {
          const groupName = p.group;
          if (!groupNames.includes(groupName)) {
            groupNames.push(groupName);
            const plist = [];
            for (const p of permissionsList) {
              if (p.group === groupName) {
                p.readonly =
                  this.readonly || !permissions.hasPermission(p.name, false);
                plist.push(p);
              }
            }
            permissionGroups.push({
              name: groupName,
              permissions: plist,
            });
          }
        }

        return permissionGroups;
      },
    },
  },

  methods: {
    valueUpdated() {
      this.$emit("input", this.modelValue);
    },

    permissionsInGroup(group) {
      let count = 0;
      for (const perm of this.modelValue) {
        if (perm.group == group) {
          count++;
        }
      }
      return count;
    },

    permissionsCheckedInGroup(group) {
      let count = 0;
      for (const perm of this.modelValue) {
        if (perm.group == group && perm.checked) {
          count++;
        }
      }
      return count;
    },
  },
};
</script>
<style></style>
