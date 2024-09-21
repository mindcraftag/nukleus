"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import Vue from 'vue';
import Router from 'vue-router';

import Approvals from '../pages/Approvals.vue';
import Clients from '../pages/Clients.vue';
import JobAgents from '../pages/JobAgents.vue';
import ClientStats from '../pages/ClientStats.vue';
import Datatypes from '../pages/Datatypes.vue';
import Plans from '../pages/Plans.vue';
import EditPlan from '../pages/EditPlan.vue';
import EditClient from '../pages/EditClient.vue';
import EditDatatype from '../pages/EditDatatype.vue';
import DataChecks from '../pages/DataChecks.vue';
import Invoices from '../pages/Invoices.vue';
import StorageMaintenance from '../pages/StorageMaintenance.vue';
import JobSchedulers from '../pages/JobSchedulers.vue';
import Purchases from '../pages/Purchases.vue';

Vue.use(Router);

const router = new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/jobagents',
      name: 'JobAgents',
      component: JobAgents,
      meta: {
        breadcrumb: [
          { name: 'JobAgents' }
        ]
      }
    },
    {
      path: '/datatypes',
      name: 'Datatypes',
      component: Datatypes,
      meta: {
        breadcrumb: [
          { name: 'Datatypes' }
        ]
      }
    },
    {
      path: '/clients',
      name: 'Clients',
      component: Clients,
      meta: {
        breadcrumb: [
          { name: 'Clients' }
        ]
      }
    },
    {
      path: '/clientstats/:id',
      name: 'ClientStats',
      component: ClientStats,
      meta: {
        breadcrumb: [
          { name: 'Client statistics' }
        ]
      }
    },
    {
      path: '/approvals',
      name: 'Approvals',
      component: Approvals,
      meta: {
        breadcrumb: [
          { name: 'Approvals' }
        ]
      }
    },
    {
      path: '/plans',
      name: 'Plans',
      component: Plans,
      meta: {
        breadcrumb: [
          { name: 'Plans' }
        ]
      }
    },
    {
      path: '/datachecks',
      name: 'DataChecks',
      component: DataChecks,
      meta: {
        breadcrumb: [
          { name: 'DataChecks' }
        ]
      }
    },
    {
      path: '/invoices',
      name: 'Invoices',
      component: Invoices,
      meta: {
        breadcrumb: [
          { name: 'Invoices' }
        ]
      }
    },
    {
      path: '/editplan/:id',
      name: 'EditPlan',
      component: EditPlan,
      meta: {
        breadcrumb: [
          { name: 'Plans', href: 'Plans' },
          { name: 'Edit Plan' }
        ]
      }
    },
    {
      path: '/editdatatype/:id',
      name: 'EditDatatype',
      component: EditDatatype,
      meta: {
        breadcrumb: [
          { name: 'Datatypes', href: 'Datatypes' },
          { name: 'Edit Datatype' }
        ]
      }
    },
    {
      path: '/editclient/:id',
      name: 'EditClient',
      component: EditClient,
      meta: {
        breadcrumb: [
          { name: 'Clients', href: 'Clients' },
          { name: 'Edit Client' }
        ]
      }
    },
    {
      path: '/storageMaintenance',
      name: 'StorageMaintenance',
      component: StorageMaintenance,
      meta: {
        breadcrumb: [
          { name: 'Storage Maintenance', href: 'StorageMaintenance' }
        ]
      }
    },
    {
      path: '/jobSchedulers',
      name: 'JobSchedulers',
      component: JobSchedulers,
      meta: {
        breadcrumb: [
          { name: 'Job Schedulers', href: 'JobSchedulers' }
        ]
      }
    },
    {
      path: '/purchases',
      name: 'Purchases',
      component: Purchases,
      meta: {
        breadcrumb: [
          { name: 'Purchases', href: 'Purchases' }
        ]
      }
    },
  ]
});


router.beforeEach((to, from, next) => {
  console.log({to, from});
  next();
})

export default router;
