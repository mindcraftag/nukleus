<template>
  <div class="wrapper">
    <!-- if we're currently searching, display a text field to search users by name -->
    <div class="selectorHeader">
      <!-- the button with the primary action -->
      <div class="mainButton" v-if="allowEdit">
        <!-- currently searching => show a button to stop searching -->
        <v-btn v-if="isSearching" @click="stopSearching">
          <v-icon>mdi-close</v-icon>
          close
        </v-btn>

        <!-- otherwise show a button to start searching -->
        <v-btn v-else @click="startSearching">
          <v-icon>mdi-account-plus-outline</v-icon>
          add user
        </v-btn>
      </div>
      <div v-if="isSearching" class="searchingContainer">
        <span>Search a user:</span>
        <div class="fieldValueContainer">
          <v-text-field
            class="floatField"
            density="compact"
            v-model="searchQuery"
            required>
          </v-text-field>
        </div>
      </div>

    </div>

    <!-- if there are users in the dataset, show the list of users for the current context (search or display)  -->
    <div
      v-if="dataset.users.length > 0"
      ref="usersList"
      class="usersList"
      @scroll="onScroll"
    >
      <!-- to make it obvious what users can't be added because they have already been added,
           we give those users the class "user--alreadyAdded" -->
      <div
        v-for="user in dataset.users"
        :class="
          'user' +
          (isSearching && user.alreadyAdded ? ' user--alreadyAdded' : '')
        "
      >
        <!-- make modifications stand out by giving those users a small mark next to their name -->
        <span v-if="user.state === 'toBeAdded'" class="userTag userTag--add"
          >Add</span
        >
        <span
          v-if="user.state === 'toBeRemoved'"
          class="userTag userTag--remove"
          >Remove</span
        >

        <span class="userName contrast--text">{{ user.name }}</span>
        <span class="userEmail">({{ user.account }})</span>

        <template v-if="allowEdit">
          <div v-if="isSearching" class="userAction">
            <!-- if we're searching and this user is already added, then we don't show a button -->
            <span v-if="user.alreadyAdded"> Added </span>

            <!-- otherwise we add a button to add this user -->
            <button v-else class="button--add" @click="addUser(user)">Add</button>
          </div>

          <div v-else class="userAction">
            <!-- if we're not searching and this user is marked for removal, we show a button to undo that -->
            <button
              v-if="user.state === 'toBeRemoved'"
              class="button--add"
              @click="undoRemoveUser(user)"
            >
              Undo
            </button>

            <!-- otherwise we show a button to remove this user -->
            <button v-else class="button--remove" @click="removeUser(user)">
              Remove
            </button>
          </div>
        </template>
      </div>

      <!-- if we have reached the end of the current context, then we display a message -->
      <div v-if="dataset.reachedEnd" class="reachedEnd">
        You have reached the end of this list.
      </div>
    </div>

    <!-- if the data in the current context is empty, display a message -->
    <div v-if="dataset.users.length === 0" class="emptyState">
      <!-- if we're in search mode, then an empty list of users means that the search query didn't return anything -->
      <span v-if="isSearching"> No users found for "{{ searchQuery }}". </span>
      <!-- if we're not searching, then an empty list of users means that no users have been added yet -->
      <span v-else>
        No users found. {{ allowEdit ? "Add some by clicking 'Add User'." : "" }}
      </span>
    </div>
  </div>
</template>

<script>

import { watch } from 'vue'

export default {
  name: 'UserSelector',
  props: {
    groupId: {
      type: String,
    },
    // This function is called whenever a change is made in this component,
    // to tell the parent component what happened.
    setModifiedUsers: {
      type: Function,
    },
    // Which ids are selected initially. If not set, all users are selected,
    // that belong to the group. If groupId is not set, all users are selected.
    initiallySelectedUserIds: {
      type: Array
    },

    allowEdit: {
      type: Boolean,
      default: true
    }
  },
  data: () => ({
    isSearching: false,
    // The searchQuery is not an empty string by default, so we can load the first page
    // of all users when switching to search mode by setting this to an empty string.
    searchQuery: "-",

    // These hold our modifications (additions and removals)
    toBeAdded: [],
    toBeRemoved: [],

    // Since the list of users is basically the same, regardless of if it's
    // displaying selected users or users returned from a query, we use two
    // objects (the datasets below) and switch between them depending on the context.
    datasetSelectedUsers: {
      users: [],
      nextCursor: null,
      reachedEnd: false,
    },
    datasetQueriedUsers: {
      users: [],
      nextCursor: null,
      reachedEnd: false,
    },
  }),
  computed: {
    // This function returns the dataset for the current view.
    // In search mode: All queried users and calculate the "alreadyAdded" property.
    // Outside search mode: All previously selected users and all users that have
    //                      been marked for addition. Also calculate the state property,
    //                      which is either "toBeAdded", "toBeRemoved" or an empty string.
    dataset() {
      // We only need the IDs of the modified users, so map every user to their ID.
      const toBeRemovedIDs = this.toBeRemoved.map((user) => user._id);
      const toBeAddedIDs = this.toBeAdded.map((user) => user._id);

      // This function takes in a user and returns their state.
      const getState = (user) => {
        if (toBeRemovedIDs.includes(user._id)) return "toBeRemoved";
        else if (toBeAddedIDs.includes(user._id)) return "toBeAdded";
        else return "";
      };

      if (this.isSearching) {
        // To calculate the "alreadyAdded" property, we first find the IDs of all added users.
        const alreadyAddedIDs = this.toBeAdded // take the added users
          .concat(this.datasetSelectedUsers.users) // add previously selected users
          .map((user) => user._id) // map every user to their ID
          .filter((id) => !toBeRemovedIDs.includes(id)); // and filter out everyone who has been marked for removal

        // calculate and attach the "alreadyAdded" property to every user
        const data = this.datasetQueriedUsers.users.map((user) => ({
          ...user,
          alreadyAdded: alreadyAddedIDs.includes(user._id),
        }));

        return {
          ...this.datasetQueriedUsers,
          users: data,
        };
      } else {
        const data = this.datasetSelectedUsers.users.concat(this.toBeAdded);

        // calculate and attach the "state" property to every user
        const users = data.map((user) => ({
          ...user,
          state: getState(user),
        }));

        return {
          ...this.datasetSelectedUsers,
          users: users,
        };
      }
    },
  },
  created() {
    watch(() => [this.searchQuery], () => {
      // When the searchQuery is changed (because the user typed into the search box),
      // we want to reset the reachedEnd property and load a fresh page of data.
      this.datasetQueriedUsers.reachedEnd = false;
      this.loadData(this.datasetQueriedUsers, this.searchQuery, null, true);
    });

    watch(() => [this.toBeRemoved, this.toBeAdded], () => {
      // When modifications are made: inform the parent component.
      this.setModifications();
    });
  },
  mounted() {
    // Load the selected users.
    this.loadData(this.datasetSelectedUsers, "", this.groupID, true, true);
  },
  methods: {
    setModifications() {
      this.setModifiedUsers({
        added: this.toBeAdded,
        removed: this.toBeRemoved,
      });
    },
    addUser(user) {
      // If we're adding a user that has previously been marked for removal,
      // then we just undo the removal.
      if (this.toBeRemoved.map((user) => user._id).includes(user._id)) {
        this.undoRemoveUser(user);
      } else {
        // Otherwise we actually add the user.
        this.toBeAdded = [...this.toBeAdded, user];
      }
    },
    removeUser(user) {
      // If we're removing a user that has previously been marked for addition,
      // then we just undo the addition.
      if (this.toBeAdded.map((user) => user._id).includes(user._id)) {
        this.toBeAdded = this.toBeAdded.filter((a) => a._id !== user._id);
      } else {
        // Otherwise we actually remove the user.
        this.toBeRemoved = [...this.toBeRemoved, user];
      }
    },
    undoRemoveUser(user) {
      this.toBeRemoved = this.toBeRemoved.filter((u) => u._id !== user._id);
    },
    // Queries users by name and groupID.
    // - obj: the dataset where the data should be loaded into
    // - forceBeginning: true if the new data should replace the existing data,
    //                   false if the new data should be appended
    // - filterInitialSelection: if set,filters shown users to initiallySelectedUsers
    // This function returns true if the end has been reached.
    loadData: async function (obj, searchQuery, groupID, forceBeginning, filterInitialSelection) {
      if ((!obj.reachedEnd && obj.nextCursor !== null) || forceBeginning) {
        const response = await this.$store.state.nkclient.queryUser(
          searchQuery,
          groupID,
          forceBeginning ? null : obj.nextCursor,
        );

        if (forceBeginning) {
          if (filterInitialSelection && this.initiallySelectedUserIds) {
            obj.users = response.data.filter(user => this.initiallySelectedUserIds.includes(user._id));
          } else {
            obj.users = response.data;
          }
        } else {
          obj.users = obj.users.concat(response.data);
        }

        if (response.next) {
          obj.nextCursor = response.next;
          return false;
        } else {
          obj.nextCursor = null;
          return true;
        }
      }

      return true;
    },
    startSearching() {
      this.searchQuery = "";
      this.isSearching = true;
    },
    stopSearching() {
      this.searchQuery = "";
      this.isSearching = false;
    },
    onScroll: async function () {
      const element = this.$refs.usersList;

      // Check if the usersList has been scrolled all the way to the bottom.
      if (element.scrollHeight - element.offsetHeight - element.scrollTop < 1) {
        // Because this event can be fired multiple times, we only want to load data once.
        if (!this.loadingMoreUsers) {
          this.loadingMoreUsers = true;

          if (this.isSearching) {
            // If we're currently in search mode, get more users for the search query.
            this.datasetQueriedUsers.reachedEnd = await this.loadData(
              this.datasetQueriedUsers,
              this.searchQuery,
              null,
              false,
            );
          } else {
            // If we're not in search mode, get more users that belong to the current group.
            this.datasetSelectedUsers.reachedEnd = await this.loadData(
              this.datasetSelectedUsers,
              "",
              this.groupID,
              false,
            );
          }

          this.loadingMoreUsers = false;
        }
      }
    },
  },
};
</script>

<style scoped>

.wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 1rem 1rem;
  font-size: 12px;
  min-width: 350px;
}

.selectorHeader {
  display: flex;
}

.searchingContainer {
  width: 100%;
}

.usersList {
  gap: 8px;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  padding-right: 0.8rem;
  max-height: 10rem;
}

.user {
  border: 1px solid rgb(204, 204, 204);
  min-height: 2rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  overflow: hidden;
  margin: 0.3rem 0;
}

.user--alreadyAdded {
  opacity: 0.6;
}

.userTag {
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.userTag--add {
  background-color: rgb(26, 173, 38);
  color: #ffffff;
}

.userTag--remove {
  background-color: rgb(211, 67, 67);
  color: #ffffff;
}

.userName {
  font-size: 1.1rem;
  margin-left: 0.5rem;
  white-space: nowrap;
}

.userEmail {
  font-size: 0.9rem;
  color: #808080;
  margin-left: 0.5rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.userAction {
  align-self: stretch;
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
}

.userAction > * {
  font-size: 1rem;
  padding: 0 1rem;
  opacity: 1;
  font-weight: 500;
  transition: opacity 0.2s;
  color: #aaaaaa;
}

.userAction > span {
  display: flex;
  align-items: center;
  justify-content: center;
}

.button--remove:hover {
  color: #d30f0f;
  background-color: #d30f0f15;
}

.button--add:hover {
  color: #0fd31f;
  background-color: #0fd31f15;
}

/* if the users input device supports hover, then add hover effects */
@media (hover: hover) {
  .userAction > button {
    opacity: 0;
  }

  .user:hover > .userAction > button {
    opacity: 1;
  }
}

.mainButton {
  display: flex;
  align-items: center;

  /* these dimensions come from v-card__title: line-height + 2 * padding */
  height: calc(2rem + 2 * 16px);
  padding-right: 16px;
}

.emptyState {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reachedEnd {
  text-align: center;
}
</style>
