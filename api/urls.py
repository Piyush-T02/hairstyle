from django.urls import path
from api import views

urlpatterns = [
    path('health', views.health_check),
    path('register', views.register_user),
    path('upload', views.upload_image),
    path('swap', views.swap_hairstyle),
]
