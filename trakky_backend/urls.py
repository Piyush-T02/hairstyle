from django.contrib import admin
from django.urls import path, include, re_path
from api import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('trakky-logo.png', views.serve_logo),
    re_path(r'^uploads/(?P<path>.*)$', views.serve_uploads),
    re_path(r'^(?P<path>.*)$', views.serve_frontend),
]
