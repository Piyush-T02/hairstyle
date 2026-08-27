from django.urls import path
from api import views

urlpatterns = [
    path('health', views.health_check),
    path('register', views.register_user),
    path('send_otp', views.send_otp),
    path('verify_otp', views.verify_otp),
    path('upload', views.upload_image),
    path('swap', views.swap_hairstyle),
]
