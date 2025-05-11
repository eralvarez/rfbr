// https://reactrouter.com/6.30.0/start/overview

import React, { PropsWithChildren, useEffect } from 'react';
import {
  RouterProvider,
  createBrowserRouter,
  Outlet,
  RouteObject,
} from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

function GenericLayout() {
  return <Outlet />;
}

function GenericLoading() {
  return null;
}

function GenericErrorBoundaryPlaceholder() {
  return null;
}

function DataLoaderComponent({
  Component,
  LoadingComponent,
  dataFunctionImportModule,
}: {
  Component: React.ComponentType<{ initialData: unknown }>;
  LoadingComponent: React.ComponentType;
  dataFunctionImportModule: Promise<{ default: () => Promise<unknown> }> | null;
}) {
  const [data, setData] = React.useState<unknown>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        if (dataFunctionImportModule) {
          const dataFunctionModule = await dataFunctionImportModule;
          const dataFunction = dataFunctionModule.default;
          const result = await dataFunction();
          setData(result);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataFunctionImportModule]);

  if (loading) {
    return <LoadingComponent />;
  }
  if (error) {
    return <div>Error: {error.message}</div>;
  }
  if (data) {
    return <Component initialData={data} />;
  }

  return null;
}

const BASE_PAGES_PATH = '/src/pages';

const _pages = import.meta.glob([
  `/src/pages/**/*.tsx`,
  '!/src/pages/**/layout.tsx',
  '!/src/pages/**/loading.tsx',
  '!/src/pages/**/error.tsx',
  '!/src/pages/**/data.ts',
]);
const _layouts = import.meta.glob<{
  default: React.ComponentType<PropsWithChildren>;
}>('/src/pages/**/layout.tsx');
const _loading = import.meta.glob<{
  default: React.ComponentType<PropsWithChildren>;
}>('/src/pages/**/loading.tsx');
const _error = import.meta.glob<{
  default: React.ComponentType<PropsWithChildren>;
}>('/src/pages/**/error.tsx');
const _data = import.meta.glob<{
  default: React.ComponentType<PropsWithChildren>;
}>('/src/pages/**/data.ts');

function pathToRoute(filePath: string) {
  return filePath
    .replace(BASE_PAGES_PATH, '')
    .replace(/\.tsx$/, '')
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/\/index$/, '')
    .replace(/\/$/, '') || '/';
}

type LazyPromise = () => Promise<{ default: React.ComponentType<unknown> }>;

const RootLayout = _layouts[`${BASE_PAGES_PATH}/layout.tsx`]
  ? React.lazy(_layouts[`${BASE_PAGES_PATH}/layout.tsx`])
  : GenericLayout;

const hasRootError = Boolean(_error[`${BASE_PAGES_PATH}/error.tsx`]);
const RootErrorBoundary = hasRootError
  ? React.lazy(_error[`${BASE_PAGES_PATH}/error.tsx`])
  : GenericErrorBoundaryPlaceholder;

const routes = () => {
  const _routes: RouteObject[] = [
    {
      path: '/',
      element: hasRootError ? (
        <ErrorBoundary fallback={<RootErrorBoundary />}>
          <RootLayout children={<Outlet />} />
        </ErrorBoundary>
      ) : (
        <RootLayout children={<Outlet />} />
      ),
      children: [],
    },
  ];

  for (const pageFile of Object.keys(_pages)) {
    const currentRoute = pathToRoute(pageFile);
    // console.log('pageFile', pageFile);
    // console.log('currentRoute', currentRoute);
    // console.log(Array(20).fill('-').join(''));

    const Component = React.lazy(_pages[pageFile] as LazyPromise);

    const splittedRoute = pageFile
      .replace(`${BASE_PAGES_PATH}/`, '')
      .split('/');
    const routeWithoutFile = splittedRoute.slice(0, -1).join('/');
    const loadingFilePath = `${BASE_PAGES_PATH}${routeWithoutFile ? `/${routeWithoutFile}` : `${routeWithoutFile}`}/loading.tsx`;
    const dataFunctionFilePath = `${BASE_PAGES_PATH}${routeWithoutFile ? `/${routeWithoutFile}` : `${routeWithoutFile}`}/data.ts`;

    const isLoadingComponentCreated = Boolean(_loading[loadingFilePath]);
    const isDataFunctionComponentSet = Boolean(_data[dataFunctionFilePath]);

    const LoadingComponent = isLoadingComponentCreated
      ? React.lazy(_loading[loadingFilePath])
      : GenericLoading;
    const dataFunctionImportModule = isDataFunctionComponentSet
      ? (_data[dataFunctionFilePath]() as Promise<{ default: () => Promise<unknown> }>)
      : null;

    let currentChildren = _routes[0].children;

    if (splittedRoute.length === 1) {
      if (splittedRoute[0] === 'index.tsx') {
        currentChildren?.push({
          index: true,
          element: (
            <React.Suspense fallback={<LoadingComponent />}>
              {isDataFunctionComponentSet ? (
                <DataLoaderComponent
                  Component={Component}
                  LoadingComponent={LoadingComponent}
                  dataFunctionImportModule={dataFunctionImportModule}
                />
              ) : (
                <Component />
              )}
            </React.Suspense>
          ),
        });
      } else {
        currentChildren?.push({
          path: currentRoute,
          element: (
            <React.Suspense fallback={<LoadingComponent />}>
              {isDataFunctionComponentSet ? (
                <DataLoaderComponent
                  Component={Component}
                  LoadingComponent={LoadingComponent}
                  dataFunctionImportModule={dataFunctionImportModule}
                />
              ) : (
                <Component />
              )}
            </React.Suspense>
          ),
        });
      }
    } else {
      let carriedPath = '';
      for (const routeOrFile of splittedRoute) {
        if (routeOrFile.endsWith('.tsx')) {
          const CurrentComponent = React.lazy(_pages[pageFile] as LazyPromise);
          if (routeOrFile === 'index.tsx') {
            currentChildren?.push({
              index: true,
              element: (
                <React.Suspense fallback={<LoadingComponent />}>
                  <CurrentComponent />
                </React.Suspense>
              ),
            });
          } else {
            currentChildren?.push({
              path: currentRoute.split('/').pop(),
              element: (
                <React.Suspense fallback={<LoadingComponent />}>
                  <CurrentComponent />
                </React.Suspense>
              ),
            });
          }
        } else {
          carriedPath += `/${routeOrFile}`;

          const isLayoutCreated = currentChildren?.some(child => {
            return child.path === carriedPath;
          });

          if (isLayoutCreated) {
            const lastChildren = currentChildren?.find(child => {
              return child.path === carriedPath;
            });
            currentChildren = lastChildren?.children;
          } else {
            const Layout = _layouts[
              `${BASE_PAGES_PATH}${carriedPath}/layout.tsx`
            ]
              ? React.lazy(
                  _layouts[`${BASE_PAGES_PATH}${carriedPath}/layout.tsx`]
                )
              : GenericLayout;
            const hasError = Boolean(
              _error[`${BASE_PAGES_PATH}${carriedPath}/error.tsx`]
            );
            const ErrorBoundaryComponent = hasError
              ? React.lazy(_error[`${BASE_PAGES_PATH}${carriedPath}/error.tsx`])
              : GenericErrorBoundaryPlaceholder;

            // console.log('routeOrFile', routeOrFile);
            const _children = {
              path: pathToRoute(routeOrFile),
              element: hasError ? (
                <ErrorBoundary fallback={<ErrorBoundaryComponent />}>
                  <React.Suspense fallback={<LoadingComponent />}>
                    <Layout children={<Outlet />} />
                  </React.Suspense>
                </ErrorBoundary>
              ) : (
                <React.Suspense fallback={<LoadingComponent />}>
                  <Layout children={<Outlet />} />
                </React.Suspense>
              ),
              children: [],
            };
            currentChildren?.push(_children);
            currentChildren = _children.children;
          }
        }
      }
    }
  }

  return _routes;
};

const browserRouter = createBrowserRouter(routes());

export default function FileBasedRouter() {
  return <RouterProvider router={browserRouter} />;
}
